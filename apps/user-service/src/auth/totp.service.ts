import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

const ISSUER = 'ВелоксДеск';
// ±1 time step (30s) either side of "now" — phone clocks drift a little and
// a user needs a moment to type the code; RFC 6238-compliant TOTP, works
// with any standard authenticator app (Google/Microsoft/Yandex/Authy/...).
authenticator.options = { window: 1 };

@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpauthUri(secret: string, email: string): string {
    return authenticator.keyuri(email, ISSUER, secret);
  }

  verifyCode(secret: string, token: string): boolean {
    if (!/^\d{6}$/.test(token)) return false;
    try {
      return authenticator.check(token, secret);
    } catch {
      // A malformed secret/token throws inside otplib rather than
      // returning false — treat that the same as "not valid".
      return false;
    }
  }
}
