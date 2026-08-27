import { NOTIFICATIONS_QUEUE_NAME } from '@veloxdesk/types';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsProducerService } from './notifications-producer.service.js';

// Shared by every producer of notification jobs (ticket-service, chat-service, ...)
// so there's exactly one BullMQ registration + wrapper for the `notifications`
// queue, not one per service.
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME })],
  providers: [NotificationsProducerService],
  exports: [NotificationsProducerService],
})
export class NotificationsQueueModule {}
