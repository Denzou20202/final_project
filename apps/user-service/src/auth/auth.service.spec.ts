import { AuthAudience, AuthProvider, Locale, UserRole } from '@veloxdesk/types';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LdapConfigService } from '../ldap-config/ldap-config.service.js';
import { OidcConfigService } from '../oidc-config/oidc-config.service.js';
import { PermissionGroupsRepository } from '../permission-groups/permission-groups.repository.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { LdapAuthProvider } from './providers/ldap-auth.provider.js';
import { LocalAuthProvider } from './providers/local-auth.provider.js';
import { TotpEncryptionService } from './totp-encryption.service.js';
import { TotpService } from './totp.service.js';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'op@veloxdesk.local',
    passwordHash: 'hashed',
    fullName: 'Оператор',
    role: UserRole.OPERATOR,
    permissionGroupId: null,
    totpSecretEncrypted: null,
    twoFactorEnabled: false,
    refreshTokenHash: null,
    deletedAt: undefined,
    authProvider: AuthProvider.LOCAL,
    // Approved by default — every test below that isn't specifically about
    // the approval gate shouldn't have to think about it. See the two
    // dedicated tests for the unapproved case.
    approvedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'group-1',
    name: 'Тестовая группа',
    restrictToDepartments: false,
    restrictToOwnTickets: false,
    cannotBeAssignee: false,
    requireTwoFactor: false,
    ipWhitelist: [] as string[],
    ...overrides,
  };
}

describe('AuthService', () => {
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      | 'findByEmail'
      | 'findById'
      | 'setRefreshTokenHash'
      | 'enableTwoFactor'
      | 'disableTwoFactor'
      | 'create'
      | 'provisionFromDirectory'
    >
  >;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds' | 'findDepartmentIds'>>;
  let totpService: jest.Mocked<Pick<TotpService, 'generateSecret' | 'buildOtpauthUri' | 'verifyCode'>>;
  let totpEncryptionService: jest.Mocked<Pick<TotpEncryptionService, 'encrypt' | 'decrypt'>>;
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock; get: jest.Mock };
  let userEventsPublisher: { publish: jest.Mock };
  let userExtraDepartmentsRepository: { find: jest.Mock };
  let ldapAuthProvider: jest.Mocked<Pick<LdapAuthProvider, 'validate'>>;
  let ldapConfigService: jest.Mocked<Pick<LdapConfigService, 'findEnabledForAudience'>>;
  let oidcConfigService: jest.Mocked<Pick<OidcConfigService, 'findEnabledForAudience'>>;
  let loginLockout: { isBanned: jest.Mock; recordFailure: jest.Mock };
  let turnstileService: { verify: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setRefreshTokenHash: jest.fn(),
      enableTwoFactor: jest.fn(),
      disableTwoFactor: jest.fn(),
      create: jest.fn(),
      provisionFromDirectory: jest.fn(),
    };
    permissionGroupsRepository = {
      findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()),
      findDepartmentIds: jest.fn().mockResolvedValue([]),
    };
    totpService = {
      generateSecret: jest.fn(),
      buildOtpauthUri: jest.fn(),
      verifyCode: jest.fn(),
    };
    totpEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn((key: string) => `secret-for-${key}`),
      get: jest.fn((_key: string, fallback: string) => fallback),
    };
    userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    userExtraDepartmentsRepository = { find: jest.fn().mockResolvedValue([]) };
    // No LDAP/OIDC config enabled by default in any of these tests — every
    // login below exercises the local (bcrypt) path via a REAL
    // LocalAuthProvider (constructed with the same mocked usersService),
    // not a re-mocked one, so this suite still verifies the actual
    // credential-check logic rather than just that it was called.
    ldapConfigService = { findEnabledForAudience: jest.fn().mockResolvedValue(null) };
    oidcConfigService = { findEnabledForAudience: jest.fn().mockResolvedValue(null) };
    ldapAuthProvider = { validate: jest.fn() };
    loginLockout = { isBanned: jest.fn().mockResolvedValue(false), recordFailure: jest.fn().mockResolvedValue(undefined) };
    // Defaults to "verified" — only the dedicated captcha tests below care
    // about a false/rejected outcome; every other test's login/register
    // calls would otherwise all fail on an assertion they aren't about.
    turnstileService = { verify: jest.fn().mockResolvedValue(true) };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as never,
      configService as never,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      totpService as unknown as TotpService,
      totpEncryptionService as unknown as TotpEncryptionService,
      userEventsPublisher as never,
      new LocalAuthProvider(usersService as unknown as UsersService),
      ldapAuthProvider as unknown as LdapAuthProvider,
      ldapConfigService as unknown as LdapConfigService,
      oidcConfigService as unknown as OidcConfigService,
      userExtraDepartmentsRepository as never,
      loginLockout as never,
      turnstileService as never,
    );

    jest.spyOn(bcrypt, 'compare').mockImplementation(async (plain) => plain === 'correct-password');
  });

  describe('login', () => {
    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      await expect(service.login({ email: 'op@veloxdesk.local', password: 'wrong' }, '1.2.3.4')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a deactivated account', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ deletedAt: new Date() }) as never);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Regression: this check didn't exist at all before — an unapproved
    // self-registered client who knew their own password could log in
    // directly, bypassing the waiting-for-approval screen entirely (which
    // was only ever enforced client-side, by the registration page's own
    // polling flow).
    it('rejects a login before admin approval', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ approvedAt: null }) as never);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('allows a login once approved', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ approvedAt: new Date() }) as never);
      const result = await service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4');
      expect(result).toHaveProperty('accessToken');
    });

    it('issues tokens directly when the user has no group', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      const result = await service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('rejects a login from outside the group IP whitelist', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ permissionGroupId: 'group-1' }) as never);
      permissionGroupsRepository.findFlagsByGroupIds.mockResolvedValue(
        new Map([['group-1', makeGroup({ ipWhitelist: ['10.0.0.0/8'] })]]) as never,
      );
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '203.0.113.5'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a login from inside the group IP whitelist', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ permissionGroupId: 'group-1' }) as never);
      permissionGroupsRepository.findFlagsByGroupIds.mockResolvedValue(
        new Map([['group-1', makeGroup({ ipWhitelist: ['10.0.0.0/8'] })]]) as never,
      );
      const result = await service.login(
        { email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF },
        '10.5.5.5',
      );
      expect(result).toHaveProperty('accessToken');
    });

    it('returns a 2FA challenge instead of tokens when the account has 2FA enabled', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ twoFactorEnabled: true }) as never);
      const result = await service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4');
      expect(result).toEqual({ requiresTwoFactor: true, challengeToken: 'signed-token' });
    });

    it('returns a forced-setup token when the group requires 2FA but it is not set up yet', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ permissionGroupId: 'group-1' }) as never);
      permissionGroupsRepository.findFlagsByGroupIds.mockResolvedValue(
        new Map([['group-1', makeGroup({ requireTwoFactor: true })]]) as never,
      );
      const result = await service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4');
      expect(result).toEqual({ requiresTwoFactorSetup: true, setupToken: 'signed-token' });
    });

    // Once LDAP is enabled for an audience, that audience's logins route
    // through the directory instead of local bcrypt — no per-user
    // fallback. See AuthService.resolveLoginUser.
    it('routes through LDAP (not local bcrypt) when LDAP is enabled for the audience, provisioning/finding the user via the directory identity', async () => {
      ldapConfigService.findEnabledForAudience.mockResolvedValue({ defaultRole: UserRole.OPERATOR } as never);
      ldapAuthProvider.validate.mockResolvedValue({ externalId: 'guid-1', email: 'ldap-user@corp.local', fullName: 'LDAP User' });
      usersService.provisionFromDirectory.mockResolvedValue(makeUser({ email: 'ldap-user@corp.local' }) as never);

      const result = await service.login(
        { email: 'ldap-user@corp.local', password: 'whatever-the-directory-checks' },
        '1.2.3.4',
      );

      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.provisionFromDirectory).toHaveBeenCalledWith(
        { externalId: 'guid-1', email: 'ldap-user@corp.local', fullName: 'LDAP User' },
        AuthProvider.LDAP,
        UserRole.OPERATOR,
      );
      expect(result).toHaveProperty('accessToken');
    });

    it('rejects an LDAP login attempt with a uniform message when the directory bind fails', async () => {
      ldapConfigService.findEnabledForAudience.mockResolvedValue({ defaultRole: UserRole.OPERATOR } as never);
      ldapAuthProvider.validate.mockResolvedValue(null);

      await expect(service.login({ email: 'ldap-user@corp.local', password: 'wrong' }, '1.2.3.4')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.provisionFromDirectory).not.toHaveBeenCalled();
    });

    // OIDC is redirect-only (see oidc-auth.controller.ts) — a password POST
    // while only OIDC is enabled for the audience must never fall back to
    // local bcrypt.
    it('rejects a password login outright when only OIDC (not LDAP) is enabled for the audience', async () => {
      oidcConfigService.findEnabledForAudience.mockResolvedValue({} as never);

      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    // Regression: audience used to be trusted purely to pick which
    // LDAP/OIDC config governs a login, never checked against the resolved
    // account's own role — so a staff (operator/admin) account that still
    // has a local passwordHash (never having gone through linkToDirectory)
    // could log in by posting audience: "client" instead, walking straight
    // past a staff-only LDAP/OIDC requirement into LocalAuthProvider and
    // minting full-privilege tokens with no directory involved at all.
    it('rejects a staff account logging in under the client audience, even with the correct local password', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ role: UserRole.ADMIN }) as never);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.CLIENT }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a client account logging in under the staff audience, even with the correct local password', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ role: UserRole.CLIENT }) as never);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('checks the IP lockout before resolving the user', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      await service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4');
      expect(loginLockout.isBanned.mock.invocationCallOrder[0]).toBeLessThan(
        usersService.findByEmail.mock.invocationCallOrder[0],
      );
    });

    // Regression: LoginLockoutService used to hard-throw a 429 once an IP
    // crossed the failure threshold — on 2026-08-26 that banned the ONE
    // apparent source address every external visitor to the site shares
    // (this Mac's Docker Desktop collapses all of them), taking the whole
    // site down for everyone for the ban's full duration. A CAPTCHA
    // requirement is the replacement: a real visitor sharing that address
    // just solves it and proceeds; a script cannot.
    it('does not require a captcha token when the IP is not flagged, even if none was sent', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      loginLockout.isBanned.mockResolvedValue(false);
      const result = await service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4');
      expect(result).toHaveProperty('accessToken');
      expect(turnstileService.verify).not.toHaveBeenCalled();
    });

    it('rejects a login from a flagged IP with no captcha token', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      loginLockout.isBanned.mockResolvedValue(true);
      turnstileService.verify.mockResolvedValue(false);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '1.2.3.4'),
      ).rejects.toThrow('Подтвердите, что вы не робот');
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('allows a login from a flagged IP once a valid captcha token is provided', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      loginLockout.isBanned.mockResolvedValue(true);
      turnstileService.verify.mockResolvedValue(true);
      const result = await service.login(
        { email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF, captchaToken: 'valid-token' },
        '1.2.3.4',
      );
      expect(result).toHaveProperty('accessToken');
      expect(turnstileService.verify).toHaveBeenCalledWith('valid-token', '1.2.3.4');
    });

    it('records a failure on a wrong password, keyed by the caller IP', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser() as never);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'wrong', audience: AuthAudience.STAFF }, '9.9.9.9'),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginLockout.recordFailure).toHaveBeenCalledWith('9.9.9.9');
    });

    it('does NOT record a failure when the password was correct but the account is merely deactivated', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ deletedAt: new Date() }) as never);
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '9.9.9.9'),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginLockout.recordFailure).not.toHaveBeenCalled();
    });

    it('does NOT record a failure when the password was correct but the IP is outside the group whitelist', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ permissionGroupId: 'group-1' }) as never);
      permissionGroupsRepository.findFlagsByGroupIds.mockResolvedValue(
        new Map([['group-1', makeGroup({ ipWhitelist: ['10.0.0.0/8'] })]]) as never,
      );
      await expect(
        service.login({ email: 'op@veloxdesk.local', password: 'correct-password', audience: AuthAudience.STAFF }, '203.0.113.5'),
      ).rejects.toThrow(ForbiddenException);
      expect(loginLockout.recordFailure).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('rejects self-registration once LDAP/OIDC is enabled for the client audience — a local account created here could never log in', async () => {
      ldapConfigService.findEnabledForAudience.mockResolvedValue({} as never);

      await expect(
        service.register({ email: 'new@example.com', password: 'a-strong-password', fullName: 'Новый клиент', captchaToken: 'test-token' }, '1.2.3.4'),
      ).rejects.toThrow();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    // Regression: registration has no "below threshold" case the way login
    // does — a public self-registration form is the classic CAPTCHA use
    // case, and it's the exact endpoint that generated the real
    // admin-facing spam (fake pending-approval Telegram notifications) on
    // 2026-08-26.
    it('rejects registration when the captcha token fails verification', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      turnstileService.verify.mockResolvedValue(false);

      await expect(
        service.register({ email: 'new@example.com', password: 'a-strong-password', fullName: 'Новый клиент', captchaToken: 'bad-token' }, '1.2.3.4'),
      ).rejects.toThrow('Проверка на робота не пройдена');
      expect(usersService.create).not.toHaveBeenCalled();
      expect(turnstileService.verify).toHaveBeenCalledWith('bad-token', '1.2.3.4');
    });

    it('passes the picked locale through to user creation', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(makeUser({ id: 'new-user-1', approvedAt: null }) as never);

      await service.register({
        email: 'new@example.com',
        password: 'a-strong-password',
        fullName: 'Новый клиент',
        locale: Locale.UK,
        captchaToken: 'test-token',
      }, '1.2.3.4');

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', locale: Locale.UK, approvedAt: null }),
      );
    });

    it('leaves locale undefined so the entity default applies when none was picked', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(makeUser({ id: 'new-user-1', approvedAt: null }) as never);

      await service.register({ email: 'new2@example.com', password: 'a-strong-password', fullName: 'Клиент', captchaToken: 'test-token' }, '1.2.3.4');

      expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({ locale: undefined }));
    });

    // Regression: resubmitting a still-pending email used to hand back its
    // userId unconditionally, no password check at all — and that userId is
    // exactly what getRegistrationStatus's short auto-login window will
    // trade for real tokens the moment an admin approves the account.
    // Anyone who merely knew a pending applicant's address (not their
    // password) could pull back their id and steal the account the instant
    // it got approved. withDeleted:true is asserted too, mirroring the same
    // fix already applied to createByAdmin.
    it('resumes a still-pending registration when the submitted password matches the existing pending row', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ id: 'pending-1', approvedAt: null, passwordHash: 'hashed' }) as never,
      );

      const result = await service.register({
        email: 'op@veloxdesk.local',
        password: 'correct-password',
        fullName: 'Кто-то',
        captchaToken: 'test-token',
      }, '1.2.3.4');

      expect(result).toEqual({ pending: true, userId: 'pending-1' });
      expect(usersService.findByEmail).toHaveBeenCalledWith('op@veloxdesk.local', { withDeleted: true });
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('rejects resuming a still-pending registration with the wrong password, without leaking its userId', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ id: 'pending-1', approvedAt: null, passwordHash: 'hashed' }) as never,
      );

      await expect(
        service.register({ email: 'op@veloxdesk.local', password: 'a-strangers-guess', fullName: 'Атакующий', captchaToken: 'test-token' }, '1.2.3.4'),
      ).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('rejects resuming a registration for a deactivated account even with the correct password', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ id: 'pending-1', approvedAt: null, deletedAt: new Date(), passwordHash: 'hashed' }) as never,
      );

      await expect(
        service.register({ email: 'op@veloxdesk.local', password: 'correct-password', fullName: 'Кто-то', captchaToken: 'test-token' }, '1.2.3.4'),
      ).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmTwoFactor', () => {
    it('rejects a wrong code and never enables 2FA', async () => {
      totpService.verifyCode.mockReturnValue(false);
      await expect(service.confirmTwoFactor('user-1', 'SECRET', '000000')).rejects.toThrow(UnauthorizedException);
      expect(usersService.enableTwoFactor).not.toHaveBeenCalled();
    });

    it('encrypts and persists the secret on a correct code', async () => {
      totpService.verifyCode.mockReturnValue(true);
      totpEncryptionService.encrypt.mockReturnValue('encrypted-blob');
      await service.confirmTwoFactor('user-1', 'SECRET', '123456');
      expect(usersService.enableTwoFactor).toHaveBeenCalledWith('user-1', 'encrypted-blob');
    });
  });

  describe('verifyTwoFactorLogin', () => {
    it('rejects an invalid or expired challenge token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
      await expect(service.verifyTwoFactorLogin('bogus', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token whose purpose does not match (e.g. a setup token reused here)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'two_factor_setup' });
      await expect(service.verifyTwoFactorLogin('setup-token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong TOTP code', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'two_factor_challenge' });
      usersService.findById.mockResolvedValue(makeUser({ totpSecretEncrypted: 'blob', twoFactorEnabled: true }) as never);
      totpEncryptionService.decrypt.mockReturnValue('SECRET');
      totpService.verifyCode.mockReturnValue(false);
      await expect(service.verifyTwoFactorLogin('challenge-token', '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens on a correct code', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'two_factor_challenge' });
      usersService.findById.mockResolvedValue(makeUser({ totpSecretEncrypted: 'blob', twoFactorEnabled: true }) as never);
      totpEncryptionService.decrypt.mockReturnValue('SECRET');
      totpService.verifyCode.mockReturnValue(true);
      const result = await service.verifyTwoFactorLogin('challenge-token', '123456');
      expect(result).toHaveProperty('accessToken');
    });
  });
});
