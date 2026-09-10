import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { TicketEventsSubscriberService } from './ticket-events-subscriber.service.js';

@Module({
  imports: [ChatModule],
  providers: [TicketEventsSubscriberService],
})
export class TicketEventsModule {}
