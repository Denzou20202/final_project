import { AuthAudience, AuthProvider } from '@veloxdesk/types';
import { Controller, Get, Logger, Param, ParseEnumPipe, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { getOidcClientConfig } from '../oidc-config/oidc-client-registry.js';
import { OidcConfigService } from '../oidc-config/oidc-config.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { OIDC_STATE_COOKIE_NAME, OIDC_STATE_COOKIE_PATH, OIDC_STATE_TOKEN_TTL, OidcStateTokenPayload } from './oidc-state-token.js';

const LOGIN_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
const STATE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

// Redirect-only — never returns JSON. Kept out of AuthController entirely
// (see that class) since every handler here ends in a 302, not a response
// body, and half of them (the callback's error paths) redirect to the SPA
// with a message instead of throwing an HttpException the frontend would
// have to parse out of a non-2xx response.
@Controller('auth/oidc')
export class OidcAuthController {
  private readonly logger = new Logger(OidcAuthController.name);

  constructor(
    private readonly oidcConfigService: OidcConfigService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle(LOGIN_THROTTLE)
  @Get(':audience/login')
  async login(@Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience, @Res() res: Response): Promise<void> {
    const config = await this.oidcConfigService.findEnabledForAudience(audience);
    if (!config || !config.clientSecretEncrypted) {
      this.redirectWithError(res, 'SSO не настроен для этого раздела');
      return;
    }

    try {
      // openid-client is ESM-only — see oidc-client-registry.ts's comment
      // on why this is a dynamic import rather than a top-level one.
      const client = await import('openid-client');
      const clientConfig = await getOidcClientConfig(audience, {
        issuerUrl: config.issuerUrl,
        clientId: config.clientId,
        clientSecret: this.oidcConfigService.decryptClientSecret(config),
      });

      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();
      const nonce = client.randomNonce();

      const authorizationUrl = client.buildAuthorizationUrl(clientConfig, {
        redirect_uri: config.redirectUri,
        scope: config.scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
      });

      const payload: OidcStateTokenPayload = { audience, state, nonce, codeVerifier };
      const stateToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_OIDC_STATE_SECRET'),
        expiresIn: OIDC_STATE_TOKEN_TTL,
      });
      res.cookie(OIDC_STATE_COOKIE_NAME, stateToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: STATE_COOKIE_MAX_AGE_MS,
        path: OIDC_STATE_COOKIE_PATH,
      });

      res.redirect(authorizationUrl.toString());
    } catch (err) {
      this.logger.warn(`OIDC login redirect failed for audience=${audience}: ${err}`);
      this.redirectWithError(res, 'Не удалось начать вход через SSO');
    }
  }

  @Throttle(LOGIN_THROTTLE)
  @Get(':audience/callback')
  async callback(
    @Param('audience', new ParseEnumPipe(AuthAudience)) audience: AuthAudience,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.clearCookie(OIDC_STATE_COOKIE_NAME, { path: OIDC_STATE_COOKIE_PATH });

    const stateCookie = req.cookies?.[OIDC_STATE_COOKIE_NAME] as string | undefined;
    if (!stateCookie) {
      this.redirectWithError(res, 'Сессия входа истекла — попробуйте снова');
      return;
    }

    let payload: OidcStateTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<OidcStateTokenPayload>(stateCookie, {
        secret: this.configService.getOrThrow<string>('JWT_OIDC_STATE_SECRET'),
      });
    } catch {
      this.redirectWithError(res, 'Сессия входа истекла — попробуйте снова');
      return;
    }
    if (payload.audience !== audience) {
      this.redirectWithError(res, 'Некорректный запрос входа');
      return;
    }

    const config = await this.oidcConfigService.findEnabledForAudience(audience);
    if (!config || !config.clientSecretEncrypted) {
      this.redirectWithError(res, 'SSO не настроен для этого раздела');
      return;
    }

    try {
      const client = await import('openid-client');
      const clientConfig = await getOidcClientConfig(audience, {
        issuerUrl: config.issuerUrl,
        clientId: config.clientId,
        clientSecret: this.oidcConfigService.decryptClientSecret(config),
      });

      const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
      const tokens = await client.authorizationCodeGrant(clientConfig, currentUrl, {
        pkceCodeVerifier: payload.codeVerifier,
        expectedState: payload.state,
        expectedNonce: payload.nonce,
      });

      const claims = tokens.claims();
      const externalId = claims?.sub;
      const email = (claims?.[config.emailClaim] as string | undefined) ?? (claims?.email as string | undefined);
      const fullName = (claims?.[config.fullNameClaim] as string | undefined) ?? (claims?.name as string | undefined);
      if (!externalId || !email || !fullName) {
        this.redirectWithError(res, 'Провайдер SSO не передал email или имя пользователя');
        return;
      }

      const user = await this.usersService.provisionFromDirectory(
        { externalId, email, fullName },
        AuthProvider.OIDC,
        config.defaultRole,
      );

      const result = await this.authService.completeLogin(user, req.ip ?? '');
      if ('requiresTwoFactor' in result) {
        res.redirect(`/auth/callback#twoFactor=challenge&challengeToken=${encodeURIComponent(result.challengeToken)}`);
        return;
      }
      if ('requiresTwoFactorSetup' in result) {
        res.redirect(`/auth/callback#twoFactor=setup&setupToken=${encodeURIComponent(result.setupToken)}`);
        return;
      }
      res.redirect(
        `/auth/callback#accessToken=${encodeURIComponent(result.accessToken)}&refreshToken=${encodeURIComponent(result.refreshToken)}`,
      );
    } catch (err) {
      this.logger.warn(`OIDC callback failed for audience=${audience}: ${err}`);
      this.redirectWithError(res, 'Не удалось войти через SSO — попробуйте снова');
    }
  }

  private redirectWithError(res: Response, message: string): void {
    res.redirect(`/auth/callback#error=${encodeURIComponent(message)}`);
  }
}
