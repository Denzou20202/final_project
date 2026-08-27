import { JwtPayload, SettingsAuditLogService } from '@veloxdesk/common';
import { MacroEntity, TeamEntity, UserEntity } from '@veloxdesk/database';
import {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionField,
  AutomationTrigger,
  CustomFieldType,
  SettingsAuditEventType,
  SettingsAuditModule,
  TicketPriority,
  UserRole,
} from '@veloxdesk/types';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { CustomFieldsService } from '../custom-fields/custom-fields.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { TicketStatusesRepository } from '../ticket-statuses/ticket-statuses.repository.js';
import { evaluateCalcFormula } from './calc-formula.js';
import { evaluateConditions } from './condition-evaluator.js';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto.js';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto.js';
import { AutomationRulesRepository } from './automation-rules.repository.js';
import { PublicAutomationRule, toPublicAutomationRule } from './automation-rule.public.js';

// How long a (jobId, ruleId) idempotency claim (see runTrigger) stays
// reserved in Redis — generous relative to BullMQ's default
// lockDuration/stalledInterval (30s each), so it comfortably outlives any
// realistic stalled-job redelivery window without needing to be tuned to
// this queue's exact config.
const RULE_RUN_CLAIM_TTL_SECONDS = 3600;

@Injectable()
export class AutomationRulesService implements OnModuleDestroy {
  private readonly logger = new Logger(AutomationRulesService.name);
  private readonly redis: Redis;

  constructor(
    private readonly rulesRepository: AutomationRulesRepository,
    private readonly ticketsService: TicketsService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly settingsAuditLog: SettingsAuditLogService,
    @InjectRepository(TeamEntity)
    private readonly teamsRepository: Repository<TeamEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(MacroEntity)
    private readonly macrosRepository: Repository<MacroEntity>,
    private readonly ticketStatusesRepository: TicketStatusesRepository,
    config: ConfigService,
  ) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
    // ioredis emits 'error' as a plain EventEmitter event — with no
    // listener, Node treats it as an unhandled 'error' event and crashes
    // the whole process on the very first Redis blip. ioredis retries the
    // underlying connection on its own; this just stops that retry's
    // transient errors from taking ticket-service down with them.
    this.redis.on('error', (error) => this.logger.error(`Redis connection error: ${error.message}`));
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  // ---- CRUD (admin) ----

  async create(dto: CreateAutomationRuleDto, actor: JwtPayload): Promise<PublicAutomationRule> {
    const conditions = dto.conditions ?? [];
    await this.validateRule(conditions, dto.actions);

    const rule = await this.rulesRepository.create({
      name: dto.name,
      trigger: dto.trigger,
      conditions,
      actions: dto.actions,
      isEnabled: dto.isEnabled ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.AUTOMATION_RULE,
      eventType: SettingsAuditEventType.CREATED,
      entityId: rule.id,
      entityLabel: rule.name,
      changes: { ...dto },
    });
    return toPublicAutomationRule(rule);
  }

  async list(): Promise<PublicAutomationRule[]> {
    const rules = await this.rulesRepository.findAll();
    return rules.map(toPublicAutomationRule);
  }

  async update(id: string, dto: UpdateAutomationRuleDto, actor: JwtPayload): Promise<PublicAutomationRule> {
    const existing = await this.getRuleOrThrow(id);
    const conditions = dto.conditions ?? existing.conditions;
    const actions = dto.actions ?? existing.actions;
    if (dto.conditions || dto.actions) {
      await this.validateRule(conditions, actions);
    }

    await this.rulesRepository.update(id, {
      name: dto.name,
      trigger: dto.trigger,
      conditions: dto.conditions,
      actions: dto.actions,
      isEnabled: dto.isEnabled,
      sortOrder: dto.sortOrder,
    });
    const updated = await this.getRuleOrThrow(id);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.AUTOMATION_RULE,
      eventType: SettingsAuditEventType.UPDATED,
      entityId: updated.id,
      entityLabel: updated.name,
      changes: { ...dto },
    });
    return toPublicAutomationRule(updated);
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const rule = await this.getRuleOrThrow(id);
    await this.rulesRepository.delete(id);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.AUTOMATION_RULE,
      eventType: SettingsAuditEventType.DELETED,
      entityId: rule.id,
      entityLabel: rule.name,
    });
  }

  private async getRuleOrThrow(id: string) {
    const rule = await this.rulesRepository.findById(id);
    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }
    return rule;
  }

  // ---- Validation ----

  private async validateRule(conditions: AutomationCondition[], actions: AutomationAction[]): Promise<void> {
    for (const condition of conditions) {
      if (condition.field === AutomationConditionField.CUSTOM_FIELD) {
        if (!condition.fieldId) {
          throw new BadRequestException('A custom-field condition requires fieldId');
        }
        await this.getCustomFieldOrThrow(condition.fieldId);
      }
    }

    if (actions.length === 0) {
      throw new BadRequestException('A rule must have at least one action');
    }

    for (const action of actions) {
      await this.validateAction(action);
    }
  }

  private async validateAction(action: AutomationAction): Promise<void> {
    switch (action.type) {
      case AutomationActionType.SET_STATUS: {
        if (!action.value || !(await this.ticketStatusesRepository.findById(action.value))) {
          throw new BadRequestException('SET_STATUS requires a valid status id');
        }
        return;
      }

      case AutomationActionType.SET_PRIORITY:
        if (!action.value || !(Object.values(TicketPriority) as string[]).includes(action.value)) {
          throw new BadRequestException('SET_PRIORITY requires a valid priority value');
        }
        return;

      case AutomationActionType.ASSIGN_TEAM: {
        if (!action.value) throw new BadRequestException('ASSIGN_TEAM requires a team id');
        const team = await this.teamsRepository.findOne({ where: { id: action.value } });
        if (!team) throw new BadRequestException('ASSIGN_TEAM: team not found');
        return;
      }

      case AutomationActionType.ASSIGN_USER: {
        if (!action.value) throw new BadRequestException('ASSIGN_USER requires a user id');
        const user = await this.usersRepository.findOne({ where: { id: action.value } });
        if (!user || user.role === UserRole.CLIENT) {
          throw new BadRequestException('ASSIGN_USER: user not found or is a client');
        }
        return;
      }

      case AutomationActionType.SET_CUSTOM_FIELD: {
        if (!action.fieldId) throw new BadRequestException('SET_CUSTOM_FIELD requires fieldId');
        const field = await this.getCustomFieldOrThrow(action.fieldId);

        const hasValue = action.value !== undefined && action.value !== '';
        const hasFormula = action.formula !== undefined && action.formula !== '';
        if (hasValue === hasFormula) {
          throw new BadRequestException('SET_CUSTOM_FIELD requires exactly one of value or formula');
        }

        if (hasFormula) {
          if (field.fieldType !== CustomFieldType.NUMBER) {
            throw new BadRequestException('A formula can only target a NUMBER custom field');
          }
          try {
            // Dry-run with all variables at 0 — catches syntax errors at
            // save time instead of silently failing (and being logged-and-
            // skipped) the first time the rule actually fires.
            evaluateCalcFormula(action.formula as string, new Map());
          } catch (err) {
            throw new BadRequestException(`Invalid formula: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        return;
      }

      case AutomationActionType.APPLY_MACRO: {
        if (!action.value) throw new BadRequestException('APPLY_MACRO requires a macro id');
        const macro = await this.macrosRepository.findOne({ where: { id: action.value } });
        if (!macro) throw new BadRequestException('APPLY_MACRO: macro not found');
        return;
      }
    }
  }

  private async getCustomFieldOrThrow(fieldId: string) {
    try {
      return await this.customFieldsService.getDefinition(fieldId);
    } catch {
      throw new BadRequestException(`Custom field ${fieldId} not found`);
    }
  }

  // ---- Engine ----

  // jobId identifies the BullMQ job this trigger run came from
  // (AutomationTriggerProcessor passes its own `job.id`) — used below to
  // dedupe a stalled-job redelivery of the SAME job re-running the SAME
  // rule. Every action a rule can take is naturally idempotent (SET_STATUS/
  // SET_PRIORITY/ASSIGN_TEAM/ASSIGN_USER each no-op if already at the
  // target value) EXCEPT APPLY_MACRO, which posts a brand-new comment on
  // every call — without this guard, a worker dying mid-run (OOM, deploy
  // restart) and BullMQ redelivering the stalled job would post a second,
  // duplicate auto-reply to the client.
  async runTrigger(trigger: AutomationTrigger, ticketId: string, jobId: string | undefined): Promise<void> {
    const rules = await this.rulesRepository.findEnabledByTrigger(trigger);
    if (rules.length === 0) return;

    for (const rule of rules) {
      if (jobId) {
        // NX = only set if absent — atomic claim, not a separate
        // check-then-act (same reasoning as every other guarded-write in
        // this codebase, e.g. TagsRepository.deleteIfUnused). A first run
        // claims it and proceeds; a redelivery of the same job finds the
        // claim already there and skips this rule entirely.
        const claimed = await this.redis.set(
          `automation-rule-run:${jobId}:${rule.id}`,
          '1',
          'EX',
          RULE_RUN_CLAIM_TTL_SECONDS,
          'NX',
        );
        if (!claimed) {
          this.logger.warn(
            `Skipping rule "${rule.name}" (${rule.id}) for ticket ${ticketId} — already applied for job ${jobId} (stalled-job redelivery)`,
          );
          continue;
        }
      }
      try {
        await this.runRule(rule.id, rule.name, rule.conditions, rule.actions, ticketId);
      } catch (err) {
        this.logger.warn(
          `Automation rule "${rule.name}" (${rule.id}) failed for ticket ${ticketId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async runRule(
    ruleId: string,
    ruleName: string,
    conditions: AutomationCondition[],
    actions: AutomationAction[],
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.ticketsService.getSnapshotForAutomation(ticketId);
    if (!ticket) return; // deleted mid-run

    const values = await this.customFieldsService.getValuesForTicket(ticketId);
    const customFieldValues = new Map(values.map((v) => [v.fieldId, v.value]));

    const matches = evaluateConditions(conditions, {
      // 'unassigned' sentinel instead of the raw status id — see
      // ConditionContext.status's own comment in condition-evaluator.ts.
      // isDefault replaces the old hardcoded OPEN check so this keeps
      // working if an admin ever changes which status new tickets start in.
      status: ticket.status.isDefault && !ticket.assignedTo ? 'unassigned' : ticket.statusId,
      priority: ticket.priority,
      teamId: ticket.teamId ?? null,
      customFieldValues,
    });
    if (!matches) return;

    for (const action of actions) {
      try {
        await this.applyAction(ticketId, action, customFieldValues);
      } catch (err) {
        this.logger.warn(
          `Automation rule "${ruleName}" (${ruleId}) action ${action.type} failed for ticket ${ticketId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async applyAction(ticketId: string, action: AutomationAction, customFieldValues: Map<string, string>): Promise<void> {
    switch (action.type) {
      case AutomationActionType.SET_STATUS:
        if (action.value) await this.ticketsService.applyAutomatedStatus(ticketId, action.value);
        return;
      case AutomationActionType.SET_PRIORITY:
        if (action.value) await this.ticketsService.applyAutomatedPriority(ticketId, action.value as TicketPriority);
        return;
      case AutomationActionType.ASSIGN_TEAM:
        if (action.value) await this.ticketsService.applyAutomatedTeam(ticketId, action.value);
        return;
      case AutomationActionType.ASSIGN_USER:
        if (action.value) await this.ticketsService.applyAutomatedAssignee(ticketId, action.value);
        return;
      case AutomationActionType.SET_CUSTOM_FIELD:
        await this.applySetCustomField(ticketId, action, customFieldValues);
        return;
      case AutomationActionType.APPLY_MACRO:
        await this.applyMacroAction(ticketId, action);
        return;
    }
  }

  private async applyMacroAction(ticketId: string, action: AutomationAction): Promise<void> {
    if (!action.value) return;
    const macro = await this.macrosRepository.findOne({ where: { id: action.value } });
    if (!macro) return; // deleted after the rule was saved — skip quietly, like ASSIGN_TEAM/ASSIGN_USER above
    await this.ticketsService.applyAutomatedReply(ticketId, macro.body);
  }

  private async applySetCustomField(
    ticketId: string,
    action: AutomationAction,
    customFieldValues: Map<string, string>,
  ): Promise<void> {
    if (!action.fieldId) return;

    let newValue: string;
    if (action.formula) {
      const numericValues = new Map<string, number>();
      for (const [fieldId, value] of customFieldValues) {
        const parsed = Number(value);
        numericValues.set(fieldId, Number.isFinite(parsed) ? parsed : 0);
      }
      newValue = String(evaluateCalcFormula(action.formula, numericValues));
    } else if (action.value !== undefined) {
      newValue = action.value;
    } else {
      return;
    }
    await this.customFieldsService.setValue(ticketId, action.fieldId, newValue);
    // Same Map instance runRule() passes to every action in this rule's
    // loop — without updating it here, a second SET_CUSTOM_FIELD action
    // later in the same rule whose formula references THIS field would see
    // its pre-rule value instead of what this action just computed/set,
    // silently breaking a chained calculation (e.g. "adjusted score" →
    // "final score" in one rule).
    customFieldValues.set(action.fieldId, newValue);
  }
}
