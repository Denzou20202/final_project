import { verifyTurnstileToken } from '@veloxdesk/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  // No token at all is the common, expected case for login (only required
  // once LoginLockoutService flags the IP) — short-circuits before ever
  // reaching the network call. A missing TURNSTILE_SECRET_KEY is instead a
  // deploy misconfiguration: logged loudly and treated as "not verified"
  // (fails closed) rather than silently letting every request through
  // unchecked, which is the worse failure mode for a security gate.
  async verify(token: string | undefined, ip: string): Promise<boolean> {
    if (!token) return false;
    const secretKey = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secretKey) {
      this.logger.error('TURNSTILE_SECRET_KEY is not configured — rejecting captcha-gated request');
      return false;
    }
    return verifyTurnstileToken(secretKey, token, ip);
  }
}
