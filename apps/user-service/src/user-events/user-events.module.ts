import { Module } from '@nestjs/common';
import { UserEventsPublisherService } from './user-events-publisher.service.js';

@Module({
  providers: [UserEventsPublisherService],
  exports: [UserEventsPublisherService],
})
export class UserEventsModule {}
