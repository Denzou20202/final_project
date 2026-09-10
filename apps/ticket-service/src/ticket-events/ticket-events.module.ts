import { Module } from '@nestjs/common';
import { TicketEventsPublisherService } from './ticket-events-publisher.service.js';

@Module({
  providers: [TicketEventsPublisherService],
  exports: [TicketEventsPublisherService],
})
export class TicketEventsModule {}
