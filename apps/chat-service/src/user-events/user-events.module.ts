import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { UserEventsSubscriberService } from './user-events-subscriber.service.js';

@Module({
  imports: [ChatModule],
  providers: [UserEventsSubscriberService],
})
export class UserEventsModule {}
