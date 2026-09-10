import { AutomationTriggerQueueModule, NotificationsQueueModule, SearchIndexQueueModule } from '@veloxdesk/common';
import {
  CommentEntity,
  PermissionGroupEntity,
  TeamEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketMentionEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Module } from '../attachments/s3.module.js';
import { CsatModule } from '../csat/csat.module.js';
import { SlaModule } from '../sla/sla.module.js';
import { TelegramNotifyModule } from '../telegram-notify/telegram-notify.module.js';
import { TicketCategoriesModule } from '../ticket-categories/ticket-categories.module.js';
import { TicketEventsModule } from '../ticket-events/ticket-events.module.js';
import { TicketStatusesModule } from '../ticket-statuses/ticket-statuses.module.js';
import { TicketTypesModule } from '../ticket-types/ticket-types.module.js';
import { SlaEscalationRepository } from './sla-escalation/sla-escalation.repository.js';
import { SlaEscalationService } from './sla-escalation/sla-escalation.service.js';
import { TicketActivityRepository } from './ticket-activity.repository.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsRepository } from './tickets.repository.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketEntity,
      TicketActivityEntity,
      CommentEntity,
      UserEntity,
      TeamEntity,
      TicketWatcherEntity,
      TicketMentionEntity,
      PermissionGroupEntity,
    ]),
    NotificationsQueueModule,
    SearchIndexQueueModule,
    AutomationTriggerQueueModule,
    TicketEventsModule,
    SlaModule,
    CsatModule,
    TelegramNotifyModule,
    TicketCategoriesModule,
    TicketStatusesModule,
    TicketTypesModule,
    S3Module,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsRepository, TicketActivityRepository, SlaEscalationRepository, SlaEscalationService],
  exports: [TicketsService, TicketActivityRepository],
})
export class TicketsModule {}
