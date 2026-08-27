import type { JwtPayload } from '@veloxdesk/common';
import { PermissionGroupEntity, UserEntity, UserExtraDepartmentEntity } from '@veloxdesk/database';
import { AuthAudience, AuthProvider, UserRole } from '@veloxdesk/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { LdapConfigService } from '../ldap-config/ldap-config.service.js';
import { OidcConfigService } from '../oidc-config/oidc-config.service.js';
import { PermissionGroupsRepository } from '../permission-groups/permission-groups.repository.js';
import { UserEventsPublisherService } from '../user-events/user-events-publisher.service.js';
import { toPublicUser } from '../users/user.public.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponse, LoginResult, PendingRegistrationResponse, RegistrationStatusResponse } from './auth-response.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { isIpAllowed } from './ip-cidr-match.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { LdapAuthProvider } from './providers/ldap-auth.provider.js';
import { LocalAuthProvider } from './providers/local-auth.provider.js';
import { TotpEncryptionService } from './totp-encryption.service.js';
import { TotpService } from './totp.service.js';
import { TurnstileService } from './turnstile.service.js';
import {
  TWO_FACTOR_CHALLENGE_PURPOSE,
  TWO_FACTOR_SETUP_PURPOSE,
  TwoFactorTokenPayload,
  TwoFactorTokenPurpose,
} from './two-factor-token.js';

const TWO_FACTOR_TOKEN_TTL = '5m';

const PASSWORD_SALT_ROUNDS = 12;

// A registration-status poll (see getRegistrationStatus) knowing only a
// userId can mint a fresh session once approved — no password involved.
// Bounding that to a short window after approvedAt keeps the exposure to
// roughly "the tab the person registered from, still open a few minutes
// later", rather than turning the userId into a permanent, standing
// password-free login backdoor for that account.
const REGISTRATION_AUTO_LOGIN_WINDOW_MS = 15 * 60 * 1000;

// bcrypt only considers the first 72 bytes of its input, so it must not be
// used directly on refresh-token JWTs — same-user tokens share a long common
// prefix (header + sub/email claims) and would collide under truncation.
// SHA-256 has no such limit and refresh tokens are already high-entropy, so a
// fast hash (compared in constant time) is the correct tool here.
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// The one place role and audience are tied together — CLIENT accounts only
// ever authenticate through the client portal, everyone else only through
// the staff one. Used to reject a login whose requested audience doesn't
// match the resolved account's own role (see resolveLoginUser).
function expectedAudienceForRole(role: UserRole): AuthAudience {
  return role === UserRole.CLIENT ? AuthAudience.CLIENT : AuthAudience.STAFF;
}

function refreshTokenMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashRefreshToken(token));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionGroupsRepository: PermissionGroupsRepository,
    private readonly totpService: TotpService,
    private readonly totpEncryptionService: TotpEncryptionService,
    private readonly userEventsPublisher: UserEventsPublisherService,
    private readonly localAuthProvider: LocalAuthProvider,
    private readonly ldapAuthProvider: LdapAuthProvider,
    private readonly ldapConfigService: LdapConfigService,
    private readonly oidcConfigService: OidcConfigService,
    @InjectRepository(UserExtraDepartmentEntity)
    private readonly userExtraDepartmentsRepository: Repository<UserExtraDepartmentEntity>,
    private readonly loginLockout: LoginLockoutService,
    private readonly turnstileService: TurnstileService,
  ) {}

  // Self-registration always requires admin approval — no tokens are issued
  // here anymore (see PendingRegistrationResponse). The waiting screen picks
  // up the rest via getRegistrationStatus below.
  async register(dto: RegisterDto, ip: string): Promise<PendingRegistrationResponse> {
    // Always required, unlike login's threshold-gated check below — a
    // public self-registration form is exactly the classic CAPTCHA use
    // case, and it's the one that generated the actual admin-facing spam
    // (fake pending-approval notifications) on 2026-08-26.
    if (!(await this.turnstileService.verify(dto.captchaToken, ip))) {
      throw new BadRequestException({ message: 'Проверка на робота не пройдена', code: 'CAPTCHA_REQUIRED' });
    }
    // Once AD/SSO is enabled for the client audience, local email+password
    // login is disabled outright for that group (no dual-mode fallback) —
    // a local account created here could never actually log in, so
    // self-registration itself has to be turned off in lockstep.
    const [ldapConfig, oidcConfig] = await Promise.all([
      this.ldapConfigService.findEnabledForAudience(AuthAudience.CLIENT),
      this.oidcConfigService.findEnabledForAudience(AuthAudience.CLIENT),
    ]);
    if (ldapConfig || oidcConfig) {
      throw new BadRequestException('Регистрация недоступна — вход выполняется через AD/SSO вашей организации');
    }

    // withDeleted: email has a plain global unique index, not partial on
    // deleted_at IS NULL (see the InitSchema migration) — a deactivated
    // account still holds its email at the DB level. Without this, the
    // check below missed it and the INSERT further down hit a raw Postgres
    // unique-violation (a confusing 500) instead of a clear "already
    // exists" — same fix already applied to createByAdmin.
    const existing = await this.usersService.findByEmail(dto.email, { withDeleted: true });
    if (existing) {
      // Resubmitting the same email while still pending (lost tab, different
      // device/browser) looks identical to a genuine duplicate at the email
      // level — resume the existing pending row instead of dead-ending, but
      // ONLY once the caller proves they're the person who submitted it, by
      // supplying its actual password. Handing back userId on email match
      // alone (the old behavior) let anyone who merely knew a pending
      // applicant's address pull back that row's id — which is all
      // getRegistrationStatus's short auto-login window needs to mint that
      // person's tokens the moment an admin approves them, no password
      // ever checked. This never touches the row itself; it's a read-only
      // proof check, not a login.
      if (!existing.approvedAt && !existing.deletedAt) {
        const passwordMatches = await bcrypt.compare(dto.password, existing.passwordHash ?? '');
        if (passwordMatches) {
          return { pending: true, userId: existing.id };
        }
      }
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: UserRole.CLIENT,
      approvedAt: null,
      locale: dto.locale,
    });

    // Best-effort, same as the older ticket-events publisher this mirrors —
    // the user row is already committed above, so a Redis hiccup here must
    // not turn a successful registration into a 500. Worst case: the admin
    // bell doesn't light up live; the pending user still shows up next time
    // any admin opens/refreshes the modal (GET /users/pending isn't
    // socket-dependent), nothing is actually lost.
    try {
      await this.userEventsPublisher.publish({
        type: 'registration_pending',
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
      });
    } catch (err) {
      this.logger.warn(`Failed to publish registration_pending for user ${user.id}: ${err}`);
    }

    return { pending: true, userId: user.id };
  }

  // Polled by the waiting screen every few seconds (see
  // REGISTRATION_STATUS_THROTTLE in auth.controller.ts). A missing row means
  // UsersService.reject hard-deleted it — see RegistrationStillPendingResponse.
  async getRegistrationStatus(userId: string, ip: string): Promise<RegistrationStatusResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return { approved: false, rejected: true };
    }
    if (!user.approvedAt) {
      return { approved: false, rejected: false };
    }

    const withinAutoLoginWindow = Date.now() - user.approvedAt.getTime() < REGISTRATION_AUTO_LOGIN_WINDOW_MS;
    if (!withinAutoLoginWindow) {
      return { approved: true };
    }

    // From here on this is nothing more than an alternate token-issuance
    // path (see this constant's comment above) — it must apply exactly the
    // same gates completeLogin does before handing out tokens, not a
    // weaker copy of them: IP allowlist first, then the same two-factor
    // branches (already-enabled → challenge, policy-required-but-not-set-up
    // → setup), in the same order, before ever reaching issueTokens.
    const context = await this.resolvePermissionContext(user);
    this.assertIpAllowed(ip, context.group);

    if (user.twoFactorEnabled) {
      const challengeToken = await this.signTwoFactorToken(user.id, TWO_FACTOR_CHALLENGE_PURPOSE);
      return { approved: true, requiresTwoFactor: true, challengeToken };
    }

    if (context.group?.requireTwoFactor) {
      const setupToken = await this.signTwoFactorToken(user.id, TWO_FACTOR_SETUP_PURPOSE);
      return { approved: true, requiresTwoFactorSetup: true, setupToken };
    }

    const tokens = await this.issueTokens(user, context);
    return { approved: true, ...tokens };
  }

  // Which provider governs a login attempt is decided by the attempt's
  // AUDIENCE (staff vs client), not by anything on the individual account —
  // once an admin enables LDAP/OIDC for a group, every login in that group
  // routes through it, with no per-user local fallback (see
  // LdapConfigEntity/OidcConfigEntity.enabled). LDAP takes priority over
  // OIDC if somehow both are enabled for the same audience (a mid-migration
  // state); OIDC itself never reaches this method at all in normal use — it
  // redirects through oidc-auth.controller.ts instead — so a password POST
  // while only OIDC is enabled is rejected outright.
  async login(dto: LoginDto, ip: string): Promise<LoginResult> {
    // Cheap, pre-DB/bcrypt check for an IP already over the failure
    // threshold — a real visitor sharing that (possibly shared, see
    // LoginLockoutService's own comment) address just solves the challenge
    // and proceeds normally below; a script cannot. Checked before any
    // credential work, same principle as assertIpAllowed further down.
    if (await this.loginLockout.isBanned(ip)) {
      if (!(await this.turnstileService.verify(dto.captchaToken, ip))) {
        throw new BadRequestException({ message: 'Подтвердите, что вы не робот', code: 'CAPTCHA_REQUIRED' });
      }
    }
    const audience = dto.audience ?? AuthAudience.CLIENT;
    let user: UserEntity;
    try {
      user = await this.resolveLoginUser(dto.email, dto.password, audience);
    } catch (error) {
      // Only resolveLoginUser's own rejections are a genuine guess against
      // this IP's failure count — completeLogin's exceptions below (a
      // CORRECT password on a deactivated/unapproved account, an IP
      // outside the group's whitelist, a 2FA branch) mean the credentials
      // already checked out, so they must never count toward locking this
      // IP out.
      if (error instanceof UnauthorizedException) {
        await this.loginLockout.recordFailure(ip);
      }
      throw error;
    }
    return this.completeLogin(user, ip);
  }

  // Everything after "we know which UserEntity this login attempt resolved
  // to" — shared by the password flow above and oidc-auth.controller.ts's
  // callback (an OIDC login has no password to check, but still needs the
  // exact same deactivated/approval/IP/2FA handling as any other login).
  async completeLogin(
    user: UserEntity,
    ip: string,
  ): Promise<LoginResult> {
    if (user.deletedAt) {
      throw new UnauthorizedException('Учётная запись деактивирована');
    }
    // Self-registration (AuthService.register) leaves this null until an
    // admin approves it — every admin-created account already has it set
    // at creation, so this can never wrongly block staff. Previously
    // unchecked here entirely: an unapproved client who knew their own
    // password could log straight in, bypassing the waiting screen (which
    // was only ever enforced client-side, by the registration page itself).
    if (!user.approvedAt) {
      throw new UnauthorizedException('Регистрация ещё не одобрена администратором');
    }

    // IP is checked once here, right after credentials are verified —
    // before any of the three outcomes below, including the forced-setup
    // branch. A challenge/setup token is only ever exchanged for real
    // tokens by this same flow (POST /auth/2fa/verify, /2fa/confirm-required),
    // so re-checking IP there would be redundant.
    const context = await this.resolvePermissionContext(user);
    this.assertIpAllowed(ip, context.group);

    if (user.twoFactorEnabled) {
      const challengeToken = await this.signTwoFactorToken(user.id, TWO_FACTOR_CHALLENGE_PURPOSE);
      return { requiresTwoFactor: true, challengeToken };
    }

    if (context.group?.requireTwoFactor) {
      const setupToken = await this.signTwoFactorToken(user.id, TWO_FACTOR_SETUP_PURPOSE);
      return { requiresTwoFactorSetup: true, setupToken };
    }

    return this.issueTokens(user, context);
  }

  private async resolveLoginUser(email: string, password: string, audience: AuthAudience): Promise<UserEntity> {
    const ldapConfig = await this.ldapConfigService.findEnabledForAudience(audience);
    if (ldapConfig) {
      const identity = await this.ldapAuthProvider.validate(email, password, audience);
      if (!identity) {
        throw new UnauthorizedException('Invalid email or password');
      }
      return this.usersService.provisionFromDirectory(identity, AuthProvider.LDAP, ldapConfig.defaultRole);
    }

    const oidcConfig = await this.oidcConfigService.findEnabledForAudience(audience);
    if (oidcConfig) {
      throw new UnauthorizedException('Вход по паролю недоступен — используйте вход через SSO');
    }

    const user = await this.localAuthProvider.validate(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Which audience governs a login is picked by the CALLER (dto.audience,
    // an unauthenticated field) purely to know which LDAP/OIDC config to
    // consult above — it must never be trusted as proof of which portal an
    // account is actually allowed to authenticate through. Without this
    // check, a staff account created before AD/SSO was enabled keeps its
    // local passwordHash forever (only linkToDirectory ever clears it, on
    // first real directory login), and posting audience: "client" on a
    // login the operator/admin portal would normally never send routes
    // straight past a staff-only LDAP/OIDC requirement into this same
    // LocalAuthProvider fallback, minting full-privilege tokens with no
    // directory involved at all.
    if (expectedAudienceForRole(user.role) !== audience) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async refresh(refreshToken: string, ip: string): Promise<AuthResponse> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Plain findById (excludes deactivated) — an account disabled mid-session
    // simply can't mint a new access token once the current one expires,
    // no separate message needed here since this path isn't user-facing.
    const user = await this.usersService.findById(payload.sub);
    if (!user?.refreshTokenHash || !refreshTokenMatches(refreshToken, user.refreshTokenHash)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const context = await this.resolvePermissionContext(user);
    this.assertIpAllowed(ip, context.group);

    return this.issueTokens(user, context, user.refreshTokenHash);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  // ===== 2FA: self-service (already logged in) =====

  // Nothing is persisted here — the secret only gets written to the user
  // row once confirmTwoFactor() verifies a real code against it, so an
  // abandoned setup (QR shown, never confirmed) never silently activates.
  async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const secret = this.totpService.generateSecret();
    return { secret, otpauthUri: this.totpService.buildOtpauthUri(secret, user.email) };
  }

  async confirmTwoFactor(userId: string, secret: string, token: string): Promise<void> {
    if (!this.totpService.verifyCode(secret, token)) {
      throw new UnauthorizedException('Неверный код');
    }
    await this.usersService.enableTwoFactor(userId, this.totpEncryptionService.encrypt(secret));
  }

  async disableTwoFactor(userId: string, password: string, token: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Неверный пароль');
    }
    if (user.passwordHash) {
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('Неверный пароль');
      }
    } else if (!user.twoFactorEnabled) {
      // Directory-provisioned/linked account with no local password and no
      // 2FA to prove — mirrors UsersService.assertSelfReauth's same guard.
      throw new UnauthorizedException('Самостоятельное отключение недоступно для этой учётной записи');
    }
    if (!user.twoFactorEnabled || !user.totpSecretEncrypted) {
      throw new BadRequestException('2FA не включена');
    }
    const secret = this.totpEncryptionService.decrypt(user.totpSecretEncrypted);
    if (!this.totpService.verifyCode(secret, token)) {
      throw new UnauthorizedException('Неверный код');
    }
    await this.usersService.disableTwoFactor(userId);
  }

  // Thin passthrough — UsersService owns the actual re-auth + password
  // change logic (assertSelfReauth, shared with the admin-panel path for
  // an admin resetting their own password), this just gives it a home
  // under /auth alongside the other self-service credential endpoints.
  async changeOwnPassword(
    actor: JwtPayload,
    currentPassword: string,
    newPassword: string,
    totpCode?: string,
  ): Promise<void> {
    return this.usersService.changeOwnPassword(actor, currentPassword, newPassword, totpCode);
  }

  // ===== 2FA: mid-login (no session yet — authenticated via a short-lived
  // purpose-scoped token instead of a real Bearer JWT, see two-factor-token.ts) =====

  async setupTwoFactorWithToken(setupToken: string): Promise<{ secret: string; otpauthUri: string }> {
    const userId = await this.verifyTwoFactorToken(setupToken, TWO_FACTOR_SETUP_PURPOSE);
    return this.setupTwoFactor(userId);
  }

  async confirmTwoFactorWithToken(setupToken: string, secret: string, token: string): Promise<AuthResponse> {
    const userId = await this.verifyTwoFactorToken(setupToken, TWO_FACTOR_SETUP_PURPOSE);
    await this.confirmTwoFactor(userId, secret, token);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.issueTokens(user);
  }

  async verifyTwoFactorLogin(challengeToken: string, token: string): Promise<AuthResponse> {
    const userId = await this.verifyTwoFactorToken(challengeToken, TWO_FACTOR_CHALLENGE_PURPOSE);
    const user = await this.usersService.findById(userId);
    if (!user?.totpSecretEncrypted) {
      throw new UnauthorizedException('2FA не настроена');
    }
    const secret = this.totpEncryptionService.decrypt(user.totpSecretEncrypted);
    if (!this.totpService.verifyCode(secret, token)) {
      throw new UnauthorizedException('Неверный код');
    }
    return this.issueTokens(user);
  }

  private async signTwoFactorToken(userId: string, purpose: TwoFactorTokenPurpose): Promise<string> {
    const payload: TwoFactorTokenPayload = { sub: userId, purpose };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_TWO_FACTOR_SECRET'),
      expiresIn: TWO_FACTOR_TOKEN_TTL,
    });
  }

  private async verifyTwoFactorToken(token: string, expectedPurpose: TwoFactorTokenPurpose): Promise<string> {
    let payload: TwoFactorTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TwoFactorTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_TWO_FACTOR_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('Invalid token');
    }
    return payload.sub;
  }

  private assertIpAllowed(ip: string, group: PermissionGroupEntity | null): void {
    if (!group || group.ipWhitelist.length === 0) return;
    if (!isIpAllowed(ip, group.ipWhitelist)) {
      throw new ForbiddenException('Вход с этого IP-адреса запрещён');
    }
  }

  // Group ∪ personal extra departments, computed fresh on every
  // login/refresh — never cached beyond the resulting JWT's own lifetime.
  private async resolvePermissionContext(
    user: UserEntity,
  ): Promise<{ group: PermissionGroupEntity | null; departmentIds: string[] }> {
    if (!user.permissionGroupId) return { group: null, departmentIds: [] };

    const groups = await this.permissionGroupsRepository.findFlagsByGroupIds([user.permissionGroupId]);
    const group = groups.get(user.permissionGroupId) ?? null;
    if (!group) return { group: null, departmentIds: [] };

    const [groupDepartmentIds, extraDepartments] = await Promise.all([
      this.permissionGroupsRepository.findDepartmentIds(group.id),
      this.userExtraDepartmentsRepository.find({ where: { userId: user.id } }),
    ]);
    const departmentIds = [...new Set([...groupDepartmentIds, ...extraDepartments.map((row) => row.teamId)])];

    return { group, departmentIds };
  }

  // `context` is optional so callers that already resolved it for the IP
  // check (login/refresh) don't pay for a second identical lookup; the 2FA
  // completion paths pass nothing and resolve here once.
  // rotateFromHash is set only by refresh() — it's the hash that was read
  // just before this call, so the write can be conditioned on it still
  // being current (see UsersRepository.rotateRefreshTokenHash). login()/2FA
  // confirmation intentionally skip this: a fresh login legitimately
  // invalidates whatever session was there before (this app keeps one
  // active refresh token per account, not per device), so an unconditional
  // overwrite there is correct, not a race.
  private async issueTokens(
    user: UserEntity,
    context?: { group: PermissionGroupEntity | null; departmentIds: string[] },
    rotateFromHash?: string,
  ): Promise<AuthResponse> {
    const { group, departmentIds } = context ?? (await this.resolvePermissionContext(user));
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(group && {
        permissionGroupId: group.id,
        restrictToDepartments: group.restrictToDepartments,
        departmentIds,
        restrictToOwnTickets: group.restrictToOwnTickets,
        cannotBeAssignee: group.cannotBeAssignee,
      }),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '30d',
        ) as JwtSignOptions['expiresIn'],
      }),
    ]);

    const newHash = hashRefreshToken(refreshToken);
    if (rotateFromHash !== undefined) {
      const rotated = await this.usersService.rotateRefreshTokenHash(user.id, rotateFromHash, newHash);
      if (!rotated) {
        // Another /auth/refresh call for the same prior token already won
        // this rotation between our read and this write — this token is now
        // stale, same as if it had been used a second time. Fail closed
        // rather than hand back a token pair the DB won't actually honor.
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    } else {
      await this.usersService.setRefreshTokenHash(user.id, newHash);
    }

    return { accessToken, refreshToken, user: toPublicUser(user, group?.cannotBeAssignee ?? false) };
  }
}
