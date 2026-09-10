import { TICKET_EVENTS_CHANNEL, TicketEventPayload } from '@veloxdesk/types';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class TicketEventsPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(TicketEventsPublisherService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
    // ioredis emits 'error' as a plain EventEmitter event — with no
    // listener, Node treats it as an unhandled 'error' event and crashes
    // the whole process on the very first Redis blip (restart, network
    // drop, OOM). ioredis retries the underlying connection on its own; all
    // this needs to do is stop that retry's transient errors from taking
    // ticket-service down with them.
    this.redis.on('error', (error) => this.logger.error(`Redis connection error: ${error.message}`));
  }

  async publish(payload: TicketEventPayload): Promise<void> {
    await this.redis.publish(TICKET_EVENTS_CHANNEL, JSON.stringify(payload));
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
