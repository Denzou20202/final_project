import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Escalation layer on top of the existing per-minute defenses (nginx's
// api_auth limit_req zone, NestJS's own @Throttle(LOGIN_THROTTLE)) — both of
// those just cap the rate and reset every 60s, so a script that respects
// (or simply gets capped by) that rate can keep retrying forever, one
// throttled burst after another, without ever actually being shut out. This
// tracks failures over a much wider window so a persistent offender can be
// escalated against instead of just rate-capped forever.
//
// This deliberately does NOT hard-block on its own — this Mac's Docker
// Desktop port-forwarding collapses EVERY external client into the same
// apparent source address before nginx ever sees it (a documented Docker
// Desktop limitation, confirmed 2026-08-26: a plain curl to the real
// public domain showed the identical address as the actual attack
// traffic). An earlier version of this service hard-banned that one
// address ALL real traffic to the site appears as, taking the whole site
// down for anyone for the ban's full duration — the blast radius of an
// IP-keyed ban is the wrong shape when IP identity itself is unreliable.
// isBanned is a pure read used to GATE a Turnstile CAPTCHA requirement
// (see AuthService.login) instead: a real visitor sharing the flagged
// address just solves one challenge and proceeds, a script cannot.
const LOCKOUT_THRESHOLD = 30;
const LOCKOUT_WINDOW_MS = 15 * 60_000;
const LOCKOUT_BAN_MS = 60 * 60_000;

function failKey(ip: string): string {
  return `login-fail:${ip}`;
}

function banKey(ip: string): string {
  return `login-ban:${ip}`;
}

@Injectable()
export class LoginLockoutService implements OnModuleDestroy {
  private readonly logger = new Logger(LoginLockoutService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
    // ioredis emits 'error' as a plain EventEmitter event — with no
    // listener, Node treats it as an unhandled 'error' event and crashes
    // the whole process on the very first Redis blip. ioredis retries the
    // underlying connection on its own; this just stops that retry's
    // transient errors from taking user-service down with them. A Redis
    // outage degrading this to "no lockout enforced" (see assertNotLocked's
    // own comment) rather than crashing login entirely is the same
    // best-effort tradeoff used throughout this codebase for anything that
    // isn't the durable write itself.
    this.redis.on('error', (error) => this.logger.error(`Redis connection error: ${error.message}`));
  }

  // Read-only — never throws, never blocks by itself (see the class
  // comment for why an outright throw here is the wrong tool on this
  // infra). Fails to `false` ("not banned", i.e. don't demand a captcha) on
  // a Redis error: this is an ADDED friction layer on top of the nginx
  // zone/NestJS throttle, which still apply regardless — a Redis blip
  // degrading this one to "skip the extra check" is the same best-effort
  // tradeoff as everything else in this class.
  async isBanned(ip: string): Promise<boolean> {
    try {
      return (await this.redis.get(banKey(ip))) !== null;
    } catch (error) {
      this.logger.warn(`Lockout check failed for ${ip}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  // Called only for an actual bad-credentials rejection (see AuthService.login)
  // — an IP-whitelist or 2FA-branch exception isn't "a guess", so those must
  // never count toward this. Same fail-open reasoning as assertNotLocked.
  async recordFailure(ip: string): Promise<void> {
    try {
      const key = failKey(ip);
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.pexpire(key, LOCKOUT_WINDOW_MS);
      }
      if (count >= LOCKOUT_THRESHOLD) {
        // NX, not a plain SET: once the ban is in place, later failures
        // while it's still active (including, if LoginValidationFailureFilter
        // ever regresses, a spurious CAPTCHA_REQUIRED "failure" from a real
        // visitor who just hasn't solved the challenge yet) must not push
        // its expiry further out. Without NX, sustained traffic above the
        // threshold could keep re-arming a fresh LOCKOUT_BAN_MS forever,
        // turning the documented "≤1h friction, self-heals" guarantee into
        // an unbounded one — this is what actually happened on 2026-08-26.
        await this.redis.set(banKey(ip), '1', 'PX', LOCKOUT_BAN_MS, 'NX');
      }
    } catch (error) {
      this.logger.warn(`Failed to record login failure for ${ip}: ${error instanceof Error ? error.message : error}`);
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
