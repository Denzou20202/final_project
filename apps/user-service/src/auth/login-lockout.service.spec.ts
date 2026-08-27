import { LoginLockoutService } from './login-lockout.service.js';

const redisMock = {
  get: jest.fn(),
  incr: jest.fn(),
  pexpire: jest.fn(),
  set: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => redisMock),
}));

describe('LoginLockoutService', () => {
  let service: LoginLockoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoginLockoutService({ get: jest.fn((_key: string, fallback: unknown) => fallback) } as never);
  });

  describe('isBanned', () => {
    it('returns false when the IP has no ban key', async () => {
      redisMock.get.mockResolvedValue(null);
      await expect(service.isBanned('1.2.3.4')).resolves.toBe(false);
    });

    // Regression: this used to hard-throw a 429 here — on 2026-08-26 that
    // banned the ONE apparent source address every external visitor to the
    // site shares (this Mac's Docker Desktop collapses all of them),
    // taking the whole site down for real visitors for the ban's full
    // duration. A pure read is deliberate now (see the class comment) —
    // the real gate lives in AuthService.login via a CAPTCHA requirement.
    it('returns true when the IP is over the threshold, without throwing', async () => {
      redisMock.get.mockResolvedValue('1');
      await expect(service.isBanned('1.2.3.4')).resolves.toBe(true);
    });

    it('fails open (returns false) if Redis itself errors', async () => {
      redisMock.get.mockRejectedValue(new Error('connection reset'));
      await expect(service.isBanned('1.2.3.4')).resolves.toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('sets an expiry only on the first failure in a window', async () => {
      redisMock.incr.mockResolvedValue(1);
      await service.recordFailure('1.2.3.4');
      expect(redisMock.pexpire).toHaveBeenCalledWith('login-fail:1.2.3.4', 15 * 60_000);
    });

    it('does not re-set the expiry on subsequent failures', async () => {
      redisMock.incr.mockResolvedValue(5);
      await service.recordFailure('1.2.3.4');
      expect(redisMock.pexpire).not.toHaveBeenCalled();
    });

    it('bans the IP once the failure count reaches the threshold', async () => {
      redisMock.incr.mockResolvedValue(30);
      await service.recordFailure('1.2.3.4');
      expect(redisMock.set).toHaveBeenCalledWith('login-ban:1.2.3.4', '1', 'PX', 60 * 60_000, 'NX');
    });

    // Regression: a plain SET (no NX) re-armed a fresh 60-minute expiry on
    // EVERY call while the count stayed at/above threshold — on a live site
    // that never actually stops, turning the documented "≤1h friction,
    // self-heals" ban into one that renews itself indefinitely (this is
    // exactly what happened on 2026-08-26, compounded by
    // LoginValidationFailureFilter counting its own CAPTCHA_REQUIRED
    // rejections as failures). NX means the second and later threshold-
    // crossing calls, while an unexpired ban already exists, are no-ops for
    // the ban key itself — expiry is set once, not extended.
    it('does not extend an already-active ban on a later above-threshold failure', async () => {
      redisMock.incr.mockResolvedValue(45);
      await service.recordFailure('1.2.3.4');
      expect(redisMock.set).toHaveBeenCalledWith('login-ban:1.2.3.4', '1', 'PX', 60 * 60_000, 'NX');
    });

    it('does not ban the IP below the threshold', async () => {
      redisMock.incr.mockResolvedValue(29);
      await service.recordFailure('1.2.3.4');
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('does not throw if Redis itself errors', async () => {
      redisMock.incr.mockRejectedValue(new Error('connection reset'));
      await expect(service.recordFailure('1.2.3.4')).resolves.toBeUndefined();
    });
  });
});
