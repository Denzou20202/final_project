import { TICKET_EVENTS_CHANNEL, TicketEventPayload } from '@veloxdesk/types';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { ChatGateway } from '../chat/chat.gateway.js';

@Injectable()
export class TicketEventsSubscriberService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TicketEventsSubscriberService.name);
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
    await this.redis.subscribe(TICKET_EVENTS_CHANNEL);
    this.redis.on('message', (_channel, message) => this.handleMessage(message));
  }

  private handleMessage(raw: string): void {
    let payload: TicketEventPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      this.logger.warn(`Received malformed ticket-events message: ${raw}`);
      return;
    }

    // A targeted event ('assigned' → the one new assignee) goes to that
    // user's own room; only genuinely shared events ('created'/'updated'/
    // 'attachment') fan out to staff at large. That fan-out must still
    // respect each recipient's own department/own-tickets restriction —
    // see ChatGateway.emitToStaffWhoCanSeeTicket's own comment for why this
    // used to reach every connected operator/admin regardless (the same
    // confidentiality gap already fixed for internal chat messages, now
    // closed here too). Fire-and-forget with an explicit .catch(): this
    // runs from a raw ioredis 'message' listener, not a NestJS request
    // context, so an unhandled rejection here would crash the whole
    // process on the first hiccup — the exact bug already fixed for
    // UserEventsSubscriberService's own forceDisconnectUser call.
    if (payload.targetUserId) {
      this.chatGateway.broadcastToUser(payload.targetUserId, 'ticket:notification', payload);
    } else {
      this.chatGateway
        .emitToStaffWhoCanSeeTicket(
          { createdBy: payload.createdBy, assignedTo: payload.assignedTo, teamId: payload.teamId },
          'ticket:notification',
          payload,
          payload.excludeUserId,
        )
        .catch((error) =>
          this.logger.warn(`Failed to fan out ticket-updated event: ${error instanceof Error ? error.message : error}`),
        );
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
