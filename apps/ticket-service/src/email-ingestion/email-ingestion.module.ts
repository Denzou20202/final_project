import { AutomationTriggerQueueModule, NotificationsQueueModule, SearchIndexQueueModule } from '@veloxdesk/common';
import { CommentEntity, TicketActivityEntity, TicketEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaModule } from '../sla/sla.module.js';
import { TicketEventsModule } from '../ticket-events/ticket-events.module.js';
import { TicketStatusesModule } from '../ticket-statuses/ticket-statuses.module.js';
import { TicketTypesModule } from '../ticket-types/ticket-types.module.js';
import { EmailIngestionService } from './email-ingestion.service.js';
import { EmailUserResolverService } from './email-user-resolver.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([TicketEntity, TicketActivityEntity, CommentEntity, UserEntity]),
    NotificationsQueueModule,
    TicketEventsModule,
    SlaModule,
    SearchIndexQueueModule,
    AutomationTriggerQueueModule,
    TicketStatusesModule,
    TicketTypesModule,
  ],
  providers: [EmailIngestionService, EmailUserResolverService],
})
export class EmailIngestionModule {}
