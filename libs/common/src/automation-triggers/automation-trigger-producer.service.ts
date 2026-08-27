import { AUTOMATION_TRIGGER_QUEUE_NAME, AutomationTrigger, AutomationTriggerJobPayload } from '@veloxdesk/types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class AutomationTriggerProducerService {
  constructor(@InjectQueue(AUTOMATION_TRIGGER_QUEUE_NAME) private readonly queue: Queue<AutomationTriggerJobPayload>) {}

  enqueue(trigger: AutomationTrigger, ticketId: string): Promise<unknown> {
    return this.queue.add(
      'run-trigger',
      { trigger, ticketId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
