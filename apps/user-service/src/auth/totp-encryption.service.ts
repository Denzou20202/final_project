import { AesGcmCipher, aesGcmKeyFromEnv } from '@veloxdesk/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// The TOTP secret must be reversible (needed to compute a fresh code every
// 30s), so it can't be hashed like a password — encrypted at rest instead,
// with the key coming from the environment (TOTP_ENCRYPTION_KEY), never
// hardcoded, same posture as the JWT secrets already in .env.production.
@Injectable()
export class TotpEncryptionService {
  private readonly cipher: AesGcmCipher;

  constructor(configService: ConfigService) {
    this.cipher = new AesGcmCipher(
      aesGcmKeyFromEnv(configService.getOrThrow<string>('TOTP_ENCRYPTION_KEY'), 'TOTP_ENCRYPTION_KEY'),
    );
  }

  encrypt(plaintext: string): string {
    return this.cipher.encrypt(plaintext);
  }

  decrypt(stored: string): string {
    return this.cipher.decrypt(stored);
  }
}
