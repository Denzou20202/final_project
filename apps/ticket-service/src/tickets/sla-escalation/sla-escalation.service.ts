import { TicketActivityType } from '@veloxdesk/types';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketActivityRepository } from '../ticket-activity.repository.js';
import { TicketsService } from '../tickets.service.js';
import { SlaEscalationRepository } from './sla-escalation.repository.js';

@Injectable()
export class SlaEscalationService {
  private readonly logger = new Logger(SlaEscalationService.name);

  constructor(
    private readonly slaEscalationRepository: SlaEscalationRepository,
    private readonly activityRepository: TicketActivityRepository,
    private readonly ticketsService: TicketsService,
  ) {}

  // waitForCompletion: without it, a run that takes longer than a minute
  // (slow DB, large candidate set) overlaps the next tick — both runs can
  // pass the alreadyEscalated check for the same ticket before either
  // writes its activity-log row, double-escalating priority and
  // double-notifying the assignee.
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async checkSlaBreaches(): Promise<void> {
    await this.checkResponseBreaches();
    await this.checkResolutionBreaches();
  }

  private async checkResponseBreaches(): Promise<void> {
    const candidates = await this.slaEscalationRepository.findResponseBreachCandidates();

    for (const ticket of candidates) {
      const alreadyEscalated = await this.activityRepository.existsOfType(
        ticket.id,
        TicketActivityType.SLA_RESPONSE_BREACHED,
      );
      if (alreadyEscalated) continue;

      const hasResponded = await this.slaEscalationRepository.hasOperatorResponse(ticket.id, ticket.createdBy);
      if (hasResponded) continue;

      // Isolated per ticket — escalatePriority throws on a priority value it
      // doesn't recognize (stale/legacy data), and this loop must not let one
      // bad ticket abort the whole minute's batch (including the resolution
      // pass that runs after it).
      try {
        await this.ticketsService.applySlaEscalation(ticket.id, TicketActivityType.SLA_RESPONSE_BREACHED);
        this.logger.warn(`Response SLA breached for ticket ${ticket.id}`);
      } catch (err) {
        this.logger.error(`Failed to escalate response SLA breach for ticket ${ticket.id}`, err instanceof Error ? err.stack : err);
      }
    }
  }

  private async checkResolutionBreaches(): Promise<void> {
    const candidates = await this.slaEscalationRepository.findResolutionBreachCandidates();

    for (const ticket of candidates) {
      const alreadyEscalated = await this.activityRepository.existsOfType(
        ticket.id,
        TicketActivityType.SLA_RESOLUTION_BREACHED,
      );
      if (alreadyEscalated) continue;

      try {
        await this.ticketsService.applySlaEscalation(ticket.id, TicketActivityType.SLA_RESOLUTION_BREACHED);
        this.logger.warn(`Resolution SLA breached for ticket ${ticket.id}`);
      } catch (err) {
        this.logger.error(`Failed to escalate resolution SLA breach for ticket ${ticket.id}`, err instanceof Error ? err.stack : err);
      }
    }
  }
}
