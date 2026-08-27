import { CsatQuestionEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramAdminNotifyService } from './telegram-admin-notify.service.js';
import { TelegramCsatNotifyService } from './telegram-csat-notify.service.js';
import { TelegramUserEventsSubscriberService } from './telegram-user-events-subscriber.service.js';

// Deliberately does NOT import TicketsModule — TicketsService needs to
// call TelegramCsatNotifyService on close, and importing TicketsModule
// here too would create a module cycle (same reasoning CsatModule's own
// comment already documents for the identical situation).
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, CsatQuestionEntity])],
  providers: [TelegramCsatNotifyService, TelegramAdminNotifyService, TelegramUserEventsSubscriberService],
  exports: [TelegramCsatNotifyService],
})
export class TelegramNotifyModule {}
