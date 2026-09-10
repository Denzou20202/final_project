import { JwtPayload } from '@veloxdesk/common';
import { UserEntity } from '@veloxdesk/database';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

// Only verifies access tokens issued by user-service — analytics-service
// never signs tokens itself, so it needs no @nestjs/jwt / JwtModule, just the
// shared JWT_ACCESS_SECRET to validate the signature.
//
// A live DB check on every request is the point (see validate() below), but
// at real concurrent load that's a lot of otherwise-avoidable PK lookups for
// the overwhelming majority of requests, where nothing changed since the
// last one. Caching a positive result briefly bounds a just-deactivated
// account's REST access to this long, worst case — the live socket kick
// (ChatGateway.forceDisconnectUser, driven by the same deactivate() call)
// already handles "immediately" for anyone with a tab open; this is the
// defense-in-depth backstop for direct API access, not the primary
// mechanism, so a short window here is an acceptable trade for the load
// this removes.
const VALID_USER_CACHE_TTL_MS = 45_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly validUserCache = new Map<string, number>();

  constructor(
    configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // A signature/expiry check alone would keep honoring an already-issued
  // token for a deactivated account until it naturally expires — this re-checks
  // against the live row (subject to the cache above), so `deactivate()`
  // takes effect within VALID_USER_CACHE_TTL_MS (a plain findOne excludes
  // soft-deleted rows by default, no separate deletedAt check needed).
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const cachedExpiry = this.validUserCache.get(payload.sub);
    if (cachedExpiry !== undefined && cachedExpiry > Date.now()) {
      return payload;
    }

    const user = await this.users.findOne({ where: { id: payload.sub }, select: ['id'] });
    if (!user) {
      this.validUserCache.delete(payload.sub);
      throw new UnauthorizedException('Учётная запись деактивирована');
    }

    this.validUserCache.set(payload.sub, Date.now() + VALID_USER_CACHE_TTL_MS);
    return payload;
  }
}
