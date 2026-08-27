import { ConfigService } from '@nestjs/config';
import { TotpEncryptionService } from './totp-encryption.service.js';

function makeService(key = Buffer.alloc(32, 7).toString('base64')): TotpEncryptionService {
  const configService = { getOrThrow: () => key } as unknown as ConfigService;
  return new TotpEncryptionService(configService);
}

describe('TotpEncryptionService', () => {
  it('round-trips a secret through encrypt/decrypt', () => {
    const service = makeService();
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = service.encrypt(secret);
    expect(encrypted).not.toContain(secret);
    expect(service.decrypt(encrypted)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const service = makeService();
    const a = service.encrypt('JBSWY3DPEHPK3PXP');
    const b = service.encrypt('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
  });

  it('rejects a key that is not exactly 32 bytes once decoded', () => {
    expect(() => makeService(Buffer.alloc(16).toString('base64'))).toThrow();
  });

  it('throws on a decrypt attempt with a mismatched key (tamper/wrong-key detection)', () => {
    const encrypted = makeService(Buffer.alloc(32, 1).toString('base64')).encrypt('JBSWY3DPEHPK3PXP');
    expect(() => makeService(Buffer.alloc(32, 2).toString('base64')).decrypt(encrypted)).toThrow();
  });
});
