import { AesGcmCipher, aesGcmKeyFromEnv } from '@veloxdesk/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Encrypts LDAP bind passwords / OIDC client secrets at rest (see
// LdapConfigEntity.bindPasswordEncrypted, OidcConfigEntity
// .clientSecretEncrypted). Deliberately its own key (DIRECTORY_SECRET_ENCRYPTION_KEY)
// rather than reusing TOTP_ENCRYPTION_KEY — a directory service-account
// credential and a user's 2FA seed have unrelated rotation/blast-radius
// concerns, and sharing a key would couple them.
@Injectable()
export class DirectorySecretEncryptionService {
  private readonly cipher: AesGcmCipher;

  constructor(configService: ConfigService) {
    this.cipher = new AesGcmCipher(
      aesGcmKeyFromEnv(
        configService.getOrThrow<string>('DIRECTORY_SECRET_ENCRYPTION_KEY'),
        'DIRECTORY_SECRET_ENCRYPTION_KEY',
      ),
    );
  }

  encrypt(plaintext: string): string {
    return this.cipher.encrypt(plaintext);
  }

  decrypt(stored: string): string {
    return this.cipher.decrypt(stored);
  }
}
