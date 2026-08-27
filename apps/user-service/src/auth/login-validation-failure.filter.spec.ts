import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { LoginValidationFailureFilter } from './login-validation-failure.filter.js';

function makeHost(ip: string) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { ip, method: 'POST', url: '/api/auth/login' };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

// Regression: this is the piece that closes the gap AuthService.login()'s
// own UnauthorizedException handling can't reach — a malformed request
// (this codebase's real 2026-08-26 incident: a scanner blasting a
// non-conforming payload at /api/auth/login, over and over) 400s out of
// NestJS's ValidationPipe before AuthService.login() is ever entered, so
// without this filter it never counted toward the IP lockout threshold at
// all despite being the actual live attack traffic.
describe('LoginValidationFailureFilter', () => {
  let loginLockout: { recordFailure: jest.Mock };
  let filter: LoginValidationFailureFilter;

  beforeEach(() => {
    loginLockout = { recordFailure: jest.fn().mockResolvedValue(undefined) };
    filter = new LoginValidationFailureFilter(loginLockout as never);
  });

  it('records a failure keyed by the request IP', async () => {
    const { host } = makeHost('5.5.5.5');
    await filter.catch(new BadRequestException('email must be an email'), host);
    expect(loginLockout.recordFailure).toHaveBeenCalledWith('5.5.5.5');
  });

  it('still produces the normal 400 JSON response afterwards', async () => {
    const { host, response } = makeHost('5.5.5.5');
    await filter.catch(new BadRequestException('email must be an email'), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'email must be an email' }),
    );
  });

  it('falls back to "unknown" when the request has no IP', async () => {
    const { host } = makeHost(undefined as unknown as string);
    await filter.catch(new BadRequestException('bad request'), host);
    expect(loginLockout.recordFailure).toHaveBeenCalledWith('unknown');
  });

  // Regression: @Catch(BadRequestException) also intercepts AuthService.
  // login()'s own CAPTCHA_REQUIRED throw, not just a DTO ValidationPipe
  // failure. Counting that as a failure meant every legitimate visitor's
  // very first login attempt from an already-flagged shared IP (the
  // frontend always submits without a token first) renewed the very
  // lockout that triggered the CAPTCHA requirement in the first place — a
  // self-perpetuating ban discovered live on 2026-08-26.
  it('does NOT record a failure for the CAPTCHA_REQUIRED lockout gate', async () => {
    const { host, response } = makeHost('5.5.5.5');
    await filter.catch(
      new BadRequestException({ message: 'Подтвердите, что вы не робот', code: 'CAPTCHA_REQUIRED' }),
      host,
    );
    expect(loginLockout.recordFailure).not.toHaveBeenCalled();
    // The response itself must still go out unchanged.
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CAPTCHA_REQUIRED' }));
  });

  it('still records a genuine DTO validation failure whose body happens to be an object', async () => {
    const { host } = makeHost('5.5.5.5');
    await filter.catch(new BadRequestException({ message: ['email must be an email'] }), host);
    expect(loginLockout.recordFailure).toHaveBeenCalledWith('5.5.5.5');
  });
});
