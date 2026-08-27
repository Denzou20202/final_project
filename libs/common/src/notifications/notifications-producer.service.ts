import { NOTIFICATIONS_QUEUE_NAME, NotificationJobPayload } from '@veloxdesk/types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsProducerService {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE_NAME) private readonly queue: Queue<NotificationJobPayload>) {}

  enqueue(payload: NotificationJobPayload): Promise<unknown> {
    return this.queue.add(payload.type, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
