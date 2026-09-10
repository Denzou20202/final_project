import { USER_EVENTS_CHANNEL, UserEventPayload } from '@veloxdesk/types';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { ChatGateway } from '../chat/chat.gateway.js';

@Injectable()
export class UserEventsSubscriberService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(UserEventsSubscriberService.name);
  private readonly redis: Redis;

  constructor(
    config: ConfigService,
    private readonly chatGateway: ChatGateway,
  ) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
    // ioredis emits 'error' as a plain EventEmitter event — with no
    // listener, Node treats it as an unhandled 'error' event and crashes
    // the whole process on the very first Redis blip. ioredis retries the
    // underlying connection on its own; this just stops that retry's
    // transient errors from taking chat-service down with them.
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
      // Only admins act on a pending registration (see UsersController's
      // pending/approve/reject) — operators get nothing here.
      this.chatGateway.broadcastToAdmins('user:registration-pending', payload);
    } else if (
      payload.type === 'account_deactivated' ||
      payload.type === 'account_deleted' ||
      payload.type === 'account_security_changed'
    ) {
      this.chatGateway.forceDisconnectUser(payload.userId).catch((error) => {
        this.logger.warn(`Failed to force-disconnect user ${payload.userId}: ${error instanceof Error ? error.message : error}`);
      });
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
