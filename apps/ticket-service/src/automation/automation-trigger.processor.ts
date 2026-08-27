import { AUTOMATION_TRIGGER_QUEUE_NAME, AutomationTriggerJobPayload } from '@veloxdesk/types';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AutomationRulesService } from './automation-rules.service.js';

// Consumer side of the automation-triggers queue. Producers: TicketsService
// (ticket_created/status_changed/priority_changed/sla_breached — same
// process, routed through the queue anyway for uniform retried/non-blocking
// apply) and chat-service's ChatService (client_replied — a genuinely
// different process).
@Processor(AUTOMATION_TRIGGER_QUEUE_NAME)
export class AutomationTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationTriggerProcessor.name);

  constructor(private readonly automationRulesService: AutomationRulesService) {
    super();
  }

  async process(job: Job<AutomationTriggerJobPayload>): Promise<void> {
    const { trigger, ticketId } = job.data;
    await this.automationRulesService.runTrigger(trigger, ticketId, job.id);
    this.logger.debug(`Ran automation trigger ${trigger} for ticket ${ticketId}`);
  }
}
