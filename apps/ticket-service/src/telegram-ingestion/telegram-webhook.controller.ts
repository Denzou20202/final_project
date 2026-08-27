import { timingSafeEqual } from 'crypto';
import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramIngestionService } from './telegram-ingestion.service.js';

// No @UseGuards — same "no auth, reachable by a third party with no
// VeloxDesk account" precedent as knowledge-service's
// public-articles.controller.ts. Protected instead by Telegram's own
// secret_token webhook mechanism (set once via setWebhook, echoed back on
// every subsequent call as this header) rather than a JWT.
@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingestion: TelegramIngestionService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    // Not a class-based DTO on purpose — the global ValidationPipe
    // (forbidNonWhitelisted: true) skips validation entirely for a
    // reflected `Object` type, which is what we want here: Telegram's
    // Update payload can grow new fields at any time, and a DTO class
    // would start rejecting requests the moment it does.
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    if (!secret || !this.secretMatches(secret)) {
      throw new ForbiddenException('Invalid webhook secret');
    }
    // Errors propagate to a 500 rather than being swallowed here — Telegram
    // retries a failed webhook delivery on its own, same reasoning as
    // email-ingestion only flagging \Seen after a message is fully
    // processed. Only recognized-but-uninteresting updates are a no-op.
    await this.ingestion.processUpdate(body);
    return { ok: true };
  }

  // Plain !== leaks timing information proportional to how many leading
  // characters match, in principle allowing the secret to be recovered
  // character-by-character — this is the only auth check on this route, so
  // it's worth the constant-time comparison even though the global
  // ThrottlerGuard already makes that attack impractically slow in
  // practice. timingSafeEqual throws on a length mismatch rather than
  // returning false, so that case is checked explicitly first.
  private secretMatches(secret: string): boolean {
    const expected = Buffer.from(this.config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET'));
    const actual = Buffer.from(secret);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
