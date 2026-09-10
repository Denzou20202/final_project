import { CurrentUser, JwtAuthGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto.js';
import { ConfirmTwoFactorDto } from './dto/confirm-two-factor.dto.js';
import { DisableTwoFactorDto } from './dto/disable-two-factor.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RegistrationStatusDto } from './dto/registration-status.dto.js';
import { TwoFactorConfirmRequiredDto } from './dto/two-factor-confirm-required.dto.js';
import { TwoFactorSetupRequiredDto } from './dto/two-factor-setup-required.dto.js';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto.js';
import { LoginValidationFailureFilter } from './login-validation-failure.filter.js';

// Each of these gets its OWN counter (@nestjs/throttler keys storage by
// controller+handler+IP, even when they all reuse the 'default' throttler
// name) — but the original limit=5/60s was too tight regardless: it's keyed
// by IP, not by account, so anyone sharing a public IP (a colleague testing
// over the same forwarded router, several browser tabs, one legitimate
// mistyped-password retry followed by a logout+login) can trip it during
// completely normal use, and login just silently stops working for a
// minute. register stays stricter — signup abuse is the real bot vector —
// while login/refresh get real headroom for interactive multi-person use.
const REGISTER_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const LOGIN_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
// Silent/background — the axios interceptor calls this automatically on any
// 401, once per tab per expired-token event, so it needs more headroom than
// a human clicking "Войти" would ever need.
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
// The waiting screen polls every ~3s (~20/min from one tab) — its own
// bucket, since REGISTER_THROTTLE is deliberately tight against signup abuse
// and would start 429ing mid-wait if reused here.
const REGISTRATION_STATUS_THROTTLE = { default: { limit: 40, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle(REGISTER_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req.ip ?? '');
  }

  // Public — the waiting screen has no session yet to authenticate with.
  // userId travels in the body rather than a :userId path param on purpose,
  // see RegistrationStatusDto's comment. req.ip is required here for the
  // same reason it's required on login/refresh below — this endpoint can
  // issue real tokens too (see AuthService.getRegistrationStatus), so it
  // needs the caller's IP to apply the same allowlist gate.
  @Throttle(REGISTRATION_STATUS_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('registration-status')
  registrationStatus(@Body() dto: RegistrationStatusDto, @Req() req: Request) {
    return this.authService.getRegistrationStatus(dto.userId, req.ip ?? '');
  }

  @Throttle(LOGIN_THROTTLE)
  @UseFilters(LoginValidationFailureFilter)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip ?? '');
  }

  @Throttle(REFRESH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req.ip ?? '');
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sub);
  }

  // ===== 2FA: self-service, requires an existing session =====

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: JwtPayload) {
    return this.authService.setupTwoFactor(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('2fa/confirm')
  async confirmTwoFactor(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmTwoFactorDto) {
    await this.authService.confirmTwoFactor(user.sub, dto.secret, dto.token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('2fa/disable')
  async disableTwoFactor(@CurrentUser() user: JwtPayload, @Body() dto: DisableTwoFactorDto) {
    await this.authService.disableTwoFactor(user.sub, dto.password, dto.token);
  }

  // Any authenticated role — client/operator/admin all change their own
  // password through this same route, no @Roles() (matches every other
  // /auth/* self-service endpoint here). Admin's Users-page "reset
  // someone's password" stays a separate, admin-only endpoint in
  // UsersController — this one can only ever act on the caller themselves.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('change-password')
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangeOwnPasswordDto) {
    await this.authService.changeOwnPassword(user, dto.currentPassword, dto.newPassword, dto.totpCode);
  }

  // ===== 2FA: mid-login, no session yet — see two-factor-token.ts =====

  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/setup-required')
  setupTwoFactorRequired(@Body() dto: TwoFactorSetupRequiredDto) {
    return this.authService.setupTwoFactorWithToken(dto.setupToken);
  }

  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/confirm-required')
  confirmTwoFactorRequired(@Body() dto: TwoFactorConfirmRequiredDto) {
    return this.authService.confirmTwoFactorWithToken(dto.setupToken, dto.secret, dto.token);
  }

  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify')
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return this.authService.verifyTwoFactorLogin(dto.challengeToken, dto.token);
  }
}
