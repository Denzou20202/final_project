import { AutomationTriggerQueueModule, NotificationsQueueModule } from '@veloxdesk/common';
import {
  CommentEntity,
  EmployeeStatusEntity,
  EmployeeStatusHistoryEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketMentionEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { EmployeeStatusService } from './employee-status.service.js';
import { PresenceService } from './presence.service.js';
import { TelegramOutboundService } from './telegram-outbound.service.js';
import { TicketViewersService } from './ticket-viewers.service.js';
import { WsAuthService } from './ws-auth.service.js';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      TicketEntity,
      CommentEntity,
      TicketWatcherEntity,
      TicketMentionEntity,
      UserEntity,
      EmployeeStatusEntity,
      EmployeeStatusHistoryEntity,
      TicketActivityEntity,
    ]),
    NotificationsQueueModule,
    AutomationTriggerQueueModule,
  ],
  providers: [
    ChatGateway,
    ChatService,
    WsAuthService,
    PresenceService,
    TicketViewersService,
    EmployeeStatusService,
    TelegramOutboundService,
  ],
  exports: [ChatGateway],
})
export class ChatModule {}
