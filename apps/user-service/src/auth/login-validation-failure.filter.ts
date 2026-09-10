import { HttpExceptionFilter } from '@veloxdesk/common';
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { LoginLockoutService } from './login-lockout.service.js';

// AuthService.login()'s own UnauthorizedException handling (see its own
// comment) only ever sees a request that already passed DTO validation — a
// malformed body (missing/non-email "email" field, wrong types, ...) 400s
// out of NestJS's global ValidationPipe before AuthService.login() is ever
// entered, so it never counts toward the lockout threshold at all. That
// turned out to be exactly the live pattern on 2026-08-26: a generic
// scanner blasting a non-conforming payload at this endpoint, over and
// over, 400 after 400 — the credential-guess (401) counter this was
// originally built around stayed at zero for that traffic the whole time.
//
// Scoped to just the login route (@UseFilters on AuthController.login) —
// register()'s own validation failures are a different, already-stricter
// budget (REGISTER_THROTTLE) and aren't part of this incident.
//
// @Catch(BadRequestException) also intercepts AuthService.login()'s own
// CAPTCHA_REQUIRED throw (a real BadRequestException, thrown before DTO
// validation would even matter) — that one must NEVER count as a failure
// here. It fires on every legitimate visitor's first attempt from an
// already-flagged shared IP (the frontend always submits without a token
// first), so counting it would mean the lockout renews itself off of the
// CAPTCHA gate's own normal operation — a self-perpetuating ban discovered
// live on 2026-08-26, distinct from LoginLockoutService's own NX fix, which
// only stops it from being un-bounded in TIME. This stops it from
// happening at all.
@Injectable()
@Catch(BadRequestException)
export class LoginValidationFailureFilter implements ExceptionFilter {
  // Delegates to the app's own global filter for the actual response so a
  // validation 400 on this one route still looks byte-for-byte identical
  // to a 400 anywhere else — this filter only adds the recordFailure side
  // effect, it doesn't get to redefine the response shape.
  private readonly delegate = new HttpExceptionFilter();

  constructor(private readonly loginLockout: LoginLockoutService) {}

  async catch(exception: BadRequestException, host: ArgumentsHost): Promise<void> {
    const request = host.switchToHttp().getRequest<Request>();
    const body = exception.getResponse();
    const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined;
    if (code !== 'CAPTCHA_REQUIRED') {
      await this.loginLockout.recordFailure(request.ip ?? 'unknown');
    }
    this.delegate.catch(exception, host);
  }
}
