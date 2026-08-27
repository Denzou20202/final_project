import { AutomationTriggerQueueModule, NotificationsQueueModule, SearchIndexQueueModule } from '@veloxdesk/common';
import {
  AttachmentEntity,
  CommentEntity,
  CsatQuestionEntity,
  KnowledgeArticleEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Service } from '../attachments/s3.service.js';
import { CsatModule } from '../csat/csat.module.js';
import { SlaModule } from '../sla/sla.module.js';
import { TicketEventsModule } from '../ticket-events/ticket-events.module.js';
import { TicketStatusesModule } from '../ticket-statuses/ticket-statuses.module.js';
import { TicketTypesModule } from '../ticket-types/ticket-types.module.js';
import { TelegramIngestionService } from './telegram-ingestion.service.js';
import { TelegramUserResolverService } from './telegram-user-resolver.service.js';
import { TelegramWebhookController } from './telegram-webhook.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketEntity,
      TicketActivityEntity,
      CommentEntity,
      UserEntity,
      TicketWatcherEntity,
      KnowledgeArticleEntity,
      AttachmentEntity,
      CsatQuestionEntity,
    ]),
    NotificationsQueueModule,
    TicketEventsModule,
    SlaModule,
    SearchIndexQueueModule,
    AutomationTriggerQueueModule,
    CsatModule,
    TicketStatusesModule,
    TicketTypesModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [TelegramIngestionService, TelegramUserResolverService, S3Service],
})
export class TelegramIngestionModule {}
