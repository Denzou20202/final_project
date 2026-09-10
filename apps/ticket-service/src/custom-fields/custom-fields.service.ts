import { JwtPayload, SettingsAuditLogService } from '@veloxdesk/common';
import { AttachmentEntity, CustomFieldDefinitionEntity } from '@veloxdesk/database';
import { CustomFieldType, SettingsAuditEventType, SettingsAuditModule } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketsService } from '../tickets/tickets.service.js';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto.js';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto.js';
import { CustomFieldsRepository } from './custom-fields.repository.js';
import {
  PublicCustomFieldDefinition,
  PublicTicketCustomFieldValue,
  toPublicCustomFieldDefinition,
  toPublicTicketCustomFieldValue,
} from './custom-field.public.js';
import { TicketCustomFieldValuesRepository } from './ticket-custom-field-values.repository.js';

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly customFieldsRepository: CustomFieldsRepository,
    private readonly valuesRepository: TicketCustomFieldValuesRepository,
    private readonly ticketsService: TicketsService,
    private readonly settingsAuditLog: SettingsAuditLogService,
    @InjectRepository(AttachmentEntity)
    private readonly attachmentsRepository: Repository<AttachmentEntity>,
  ) {}

  async createDefinition(dto: CreateCustomFieldDefinitionDto, actor: JwtPayload): Promise<PublicCustomFieldDefinition> {
    if (dto.fieldType === CustomFieldType.REGEX) this.assertValidPattern(dto.pattern);
    if (dto.dependsOnFieldId) await this.assertValidDependency(dto.dependsOnFieldId);

    const field = await this.customFieldsRepository.create(dto);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.CUSTOM_FIELD,
      eventType: SettingsAuditEventType.CREATED,
      entityId: field.id,
      entityLabel: field.label,
      changes: { ...dto },
    });
    return toPublicCustomFieldDefinition(field);
  }

  async listDefinitions(): Promise<PublicCustomFieldDefinition[]> {
    const fields = await this.customFieldsRepository.findAll();
    return fields.map(toPublicCustomFieldDefinition);
  }

  async getDefinition(id: string): Promise<PublicCustomFieldDefinition> {
    const field = await this.getDefinitionOrThrow(id);
    return toPublicCustomFieldDefinition(field);
  }

  async updateDefinition(
    id: string,
    dto: UpdateCustomFieldDefinitionDto,
    actor: JwtPayload,
  ): Promise<PublicCustomFieldDefinition> {
    const existing = await this.getDefinitionOrThrow(id);
    if (dto.pattern !== undefined && existing.fieldType === CustomFieldType.REGEX) this.assertValidPattern(dto.pattern);
    if (dto.dependsOnFieldId !== undefined) {
      if (dto.dependsOnFieldId === id) {
        throw new BadRequestException('A field cannot depend on itself');
      }
      if (dto.dependsOnFieldId) await this.assertValidDependency(dto.dependsOnFieldId, id);
    }

    await this.customFieldsRepository.update(id, dto);
    const updated = await this.getDefinitionOrThrow(id);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.CUSTOM_FIELD,
      eventType: SettingsAuditEventType.UPDATED,
      entityId: updated.id,
      entityLabel: updated.label,
      changes: { ...dto },
    });
    return toPublicCustomFieldDefinition(updated);
  }

  // Guarded at the app level (not just the DB — ticket_custom_field_values.
  // field_id is ON DELETE CASCADE, so an unconditional delete would silently
  // wipe every ticket's recorded answer for this field). Unlike
  // TeamsService.remove()'s plain count-then-reject, the guard itself is the
  // atomic conditional delete in deleteIfUnused() — a separate count-check
  // here followed by a delete() would leave a TOCTOU race (a value just
  // saved for this field, between the check and the delete, getting
  // silently cascaded away). Mirrors TagsService.remove() exactly.
  // countValuesForField is only used afterward, to put a number in the
  // rejection message.
  async removeDefinition(id: string, actor: JwtPayload): Promise<void> {
    const field = await this.getDefinitionOrThrow(id);
    const deleted = await this.customFieldsRepository.deleteIfUnused(id);
    if (!deleted) {
      const valueCount = await this.customFieldsRepository.countValuesForField(id);
      throw new BadRequestException(
        `Нельзя удалить поле «${field.label}» — на него ссылаются тикеты (${valueCount}). Сначала очистите значение этого поля в этих тикетах.`,
      );
    }
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.CUSTOM_FIELD,
      eventType: SettingsAuditEventType.DELETED,
      entityId: field.id,
      entityLabel: field.label,
    });
  }

  // `actor` is omitted by the automation engine (runRule/applySetCustomField
  // in automation-rules.service.ts) — same system-wide, no-RBAC convention as
  // TicketsService.applyAutomated*/getSnapshotForAutomation. Every
  // controller-driven call must pass a real actor so the department/
  // own-tickets restrictions enforced everywhere else on ticket data apply
  // here too — this used to be missing entirely, letting any staff member
  // read/write custom fields on any ticket regardless of scope.
  async getValuesForTicket(ticketId: string, actor?: JwtPayload): Promise<PublicTicketCustomFieldValue[]> {
    if (actor) await this.ticketsService.assertAccess(ticketId, actor);
    const values = await this.valuesRepository.findByTicket(ticketId);
    return values.map(toPublicTicketCustomFieldValue);
  }

  async setValue(ticketId: string, fieldId: string, value: string, actor?: JwtPayload): Promise<void> {
    if (actor) await this.ticketsService.assertAccess(ticketId, actor);
    const field = await this.getDefinitionOrThrow(fieldId);
    if (value.trim() === '') {
      await this.valuesRepository.delete(ticketId, fieldId);
      return;
    }

    await this.assertValidValue(field, ticketId, value);
    await this.valuesRepository.upsert(ticketId, fieldId, value);
  }

  private async assertValidValue(
    field: Awaited<ReturnType<CustomFieldsService['getDefinitionOrThrow']>>,
    ticketId: string,
    value: string,
  ): Promise<void> {
    switch (field.fieldType) {
      case CustomFieldType.CHECKBOX:
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException('A checkbox field only accepts "true" or "false"');
        }
        return;

      case CustomFieldType.REGEX: {
        const pattern = field.pattern ? new RegExp(field.pattern) : null;
        if (!pattern || !pattern.test(value)) {
          throw new BadRequestException(`Value does not match the required pattern for "${field.label}"`);
        }
        return;
      }

      case CustomFieldType.FILE: {
        const attachment = await this.attachmentsRepository.findOne({ where: { id: value } });
        if (!attachment || attachment.ticketId !== ticketId) {
          throw new BadRequestException('Value must be the id of an attachment already uploaded to this ticket');
        }
        return;
      }

      case CustomFieldType.SELECT: {
        // Hierarchical narrowing only applies when both pieces are present
        // — a plain SELECT (no dependsOnFieldId/optionsByParent) keeps
        // accepting anything in its flat `options`, unvalidated here (same
        // as before this feature — the dropdown UI already constrains it).
        if (!field.dependsOnFieldId || !field.optionsByParent) return;
        const siblingValues = await this.valuesRepository.findByTicket(ticketId);
        const parentValue = siblingValues.find((v) => v.fieldId === field.dependsOnFieldId)?.value;
        const allowed = parentValue ? (field.optionsByParent[parentValue] ?? []) : [];
        if (!allowed.includes(value)) {
          throw new BadRequestException(`"${value}" is not a valid option for "${field.label}" given its parent field's current value`);
        }
        return;
      }

      default:
        return;
    }
  }

  private assertValidPattern(pattern: string | undefined): void {
    if (!pattern) {
      throw new BadRequestException('A REGEX field requires a pattern');
    }
    try {
      new RegExp(pattern);
    } catch (err) {
      throw new BadRequestException(`Invalid pattern: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Walks the FULL chain upward from the proposed dependency, not just one
  // hop — an immediate-2-cycle-only check (dependency.dependsOnFieldId ===
  // selfId) lets a longer cycle through: create A (no dep), B depends-on A,
  // C depends-on B, then edit A to depend on C. For conditionValue-gated
  // fields that's not just a modeling oddity — it permanently deadlocks the
  // ticket UI, since every field in the cycle stays hidden forever (showing
  // any one of them requires another link in the same cycle to already have
  // a value, which requires it to already be visible). One findAll() plus an
  // in-memory walk instead of a chain of sequential findById calls, bounded
  // by the field count as a defensive guard against a pre-existing corrupt
  // chain rather than an expected case once this check is in place.
  private async assertValidDependency(dependsOnFieldId: string, selfId?: string): Promise<void> {
    const dependency = await this.customFieldsRepository.findById(dependsOnFieldId);
    if (!dependency) {
      throw new BadRequestException('dependsOnFieldId does not reference an existing custom field');
    }
    if (!selfId) return;

    const allFields = await this.customFieldsRepository.findAll();
    const byId = new Map(allFields.map((f) => [f.id, f]));
    let current: CustomFieldDefinitionEntity | undefined = dependency;
    for (let hops = 0; current && hops < allFields.length; hops++) {
      if (current.id === selfId) {
        throw new BadRequestException('This would create a circular dependency chain between fields');
      }
      current = current.dependsOnFieldId ? byId.get(current.dependsOnFieldId) : undefined;
    }
  }

  private async getDefinitionOrThrow(id: string) {
    const field = await this.customFieldsRepository.findById(id);
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }
    return field;
  }
}
