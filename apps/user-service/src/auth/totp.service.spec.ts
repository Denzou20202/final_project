import { authenticator } from 'otplib';
import { TotpService } from './totp.service.js';

describe('TotpService', () => {
  const service = new TotpService();

  it('generates a non-empty base32 secret', () => {
    const secret = service.generateSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it('builds an otpauth:// URI carrying the issuer and account email', () => {
    const uri = service.buildOtpauthUri('JBSWY3DPEHPK3PXP', 'op@veloxdesk.local');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(decodeURIComponent(uri)).toContain('op@veloxdesk.local');
    expect(decodeURIComponent(uri)).toContain('ВелоксДеск');
  });

  it('accepts a freshly generated code for the same secret', () => {
    const secret = service.generateSecret();
    const code = authenticator.generate(secret);
    expect(service.verifyCode(secret, code)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const secret = service.generateSecret();
    expect(service.verifyCode(secret, '000000')).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    const secret = service.generateSecret();
    expect(service.verifyCode(secret, 'abcdef')).toBe(false);
    expect(service.verifyCode(secret, '12345')).toBe(false);
  });
});
