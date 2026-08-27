import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';

describe('OptionalJwtAuthGuard', () => {
  it('returns the user when the token resolved one', () => {
    const guard = new OptionalJwtAuthGuard();
    const user = { sub: 'user-1', role: 'client' };

    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('returns undefined instead of throwing when there is no token', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.handleRequest(null, false)).toBeUndefined();
  });

  it('returns undefined instead of throwing on an error (e.g. a deactivated account)', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.handleRequest(new Error('Учётная запись деактивирована'), false)).toBeUndefined();
  });
});
