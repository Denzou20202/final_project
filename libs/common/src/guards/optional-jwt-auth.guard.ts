import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

// Same 'jwt' Passport strategy as JwtAuthGuard, but never rejects the
// request over a missing/invalid/expired token — request.user is just left
// undefined instead of throwing, so @CurrentUser() (already tolerant of a
// missing request.user) returns an optional actor. JwtStrategy.validate()'s
// live-DB "Учётная запись деактивирована" check surfaces here as `err`,
// which this ignores too — a deactivated account's stale token is treated
// exactly like no token, not surfaced as a 401.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = JwtPayload>(_err: unknown, user: TUser | false): TUser | undefined {
    return user || undefined;
  }
}
