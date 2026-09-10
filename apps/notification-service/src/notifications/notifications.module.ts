import { NotificationEntity, TicketEntity, UserEntity } from '@veloxdesk/database';
import { NOTIFICATIONS_QUEUE_NAME } from '@veloxdesk/types';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from './mailer.service.js';
import { NotificationsProcessor } from './notifications.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE_NAME }),
    TypeOrmModule.forFeature([UserEntity, TicketEntity, NotificationEntity]),
  ],
  providers: [MailerService, NotificationsProcessor],
})
export class NotificationsModule {}
