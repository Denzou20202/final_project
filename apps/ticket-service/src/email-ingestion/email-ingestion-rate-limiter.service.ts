import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Nothing else gates this channel: unlike the HTTP API (nginx's
// limit_req_zone, NestJS's @Throttle) or login (LoginLockoutService), the
// IMAP poll (see EmailIngestionService) runs entirely outside nginx's reach
// and had no per-sender or global cap at all — a single From: address (or
// many distinct ones) could get one ticket/comment created per message,
// unbounded within and across every 15s poll tick.
//
// Same fail-open posture as LoginLockoutService: a Redis blip degrades this
// to "no extra limit enforced" rather than blocking a real support channel
// over an infra hiccup — nothing else backs this one up if it goes silent,
// but that's a smaller blast radius than emailing in stops working at all.
const PER_SENDER_THRESHOLD = 5;
const GLOBAL_THRESHOLD = 50;
const WINDOW_MS = 15 * 60_000;

function senderKey(address: string): string {
  return `email-ingestion:sender:${address.toLowerCase()}`;
}

const GLOBAL_KEY = 'email-ingestion:global';

@Injectable()
export class EmailIngestionRateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailIngestionRateLimiterService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
    // Same reasoning as LoginLockoutService — an unhandled 'error' event on
    // this EventEmitter would otherwise crash the whole ticket-service on
    // the first Redis blip.
    this.redis.on('error', (error) => this.logger.error(`Redis connection error: ${error.message}`));
  }

  // Checked once per inbound message, before it can create a ticket or
  // append a reply — see EmailIngestionService.processMessage. A message
  // that fails this is still flagged \Seen by the caller (this returns a
  // plain boolean, doesn't throw), so a flood doesn't just keep re-arriving
  // on every subsequent poll.
  async shouldProcess(fromAddress: string): Promise<boolean> {
    try {
      const [senderCount, globalCount] = await Promise.all([
        this.incrementWithExpiry(senderKey(fromAddress)),
        this.incrementWithExpiry(GLOBAL_KEY),
      ]);
      if (senderCount > PER_SENDER_THRESHOLD) {
        this.logger.warn(
          `Rate-limiting inbound email from ${fromAddress} — ${senderCount} messages in the last ${WINDOW_MS / 60_000} min`,
        );
        return false;
      }
      if (globalCount > GLOBAL_THRESHOLD) {
        this.logger.warn(
          `Rate-limiting inbound email ingestion globally — ${globalCount} messages in the last ${WINDOW_MS / 60_000} min`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Rate limit check failed for ${fromAddress}: ${error instanceof Error ? error.message : error}`);
      return true;
    }
  }

  private async incrementWithExpiry(key: string): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, WINDOW_MS);
    }
    return count;
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
