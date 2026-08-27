import { USER_EVENTS_CHANNEL, UserEventPayload } from '@veloxdesk/types';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { TelegramAdminNotifyService } from './telegram-admin-notify.service.js';

// A second, independent subscriber on the same USER_EVENTS_CHANNEL
// chat-service's own UserEventsSubscriberService already listens on —
// Redis pub/sub delivers a copy of every message to every subscriber, so
// this doesn't touch or duplicate that existing in-app-bell relay, it just
// adds a Telegram-reaching one alongside it.
@Injectable()
export class TelegramUserEventsSubscriberService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramUserEventsSubscriberService.name);
  private readonly redis: Redis;

  constructor(
    config: ConfigService,
    private readonly telegramAdminNotify: TelegramAdminNotifyService,
  ) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
    // ioredis emits 'error' as a plain EventEmitter event — with no
    // listener, Node treats it as an unhandled 'error' event and crashes
    // the whole process on the very first Redis blip. ioredis retries the
    // underlying connection on its own; this just stops that retry's
    // transient errors from taking ticket-service down with them.
    this.redis.on('error', (error) => this.logger.error(`Redis connection error: ${error.message}`));
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.redis.subscribe(USER_EVENTS_CHANNEL);
    this.redis.on('message', (_channel, message) => this.handleMessage(message));
  }

  private handleMessage(raw: string): void {
    let payload: UserEventPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      this.logger.warn(`Received malformed user-events message: ${raw}`);
      return;
    }

    if (payload.type === 'registration_pending') {
      void this.telegramAdminNotify.notifyRegistrationPending(payload);
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
