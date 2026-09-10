import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

// Generic AES-256-GCM encrypt/decrypt for "must be reversible, so can't be
// hashed" secrets at rest (TOTP secrets, LDAP bind passwords, OIDC client
// secrets, ...). Each caller holds its own key — see envKeyToAesGcmKey —
// so unrelated secrets never share a rotation/blast-radius boundary just
// because they use the same cipher.
export class AesGcmCipher {
  constructor(private readonly key: Buffer) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.');
  }

  decrypt(stored: string): string {
    const [ivB64, authTagB64, ciphertextB64] = stored.split('.');
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error('Malformed encrypted value');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]).toString('utf8');
  }
}

// `envValue` is expected to be a base64-encoded 32-byte key (AES-256) — same
// convention as the pre-existing TOTP_ENCRYPTION_KEY. `envVarName` is only
// used to make the thrown error identify which key is misconfigured.
export function aesGcmKeyFromEnv(envValue: string, envVarName: string): Buffer {
  const key = Buffer.from(envValue, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`${envVarName} must be a base64-encoded 32-byte key (AES-256)`);
  }
  return key;
}
