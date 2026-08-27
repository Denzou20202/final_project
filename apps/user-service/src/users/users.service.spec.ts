import { AuthProvider, Locale, UserRole } from '@veloxdesk/types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CitiesRepository } from '../cities/cities.repository.js';
import { CompaniesRepository } from '../companies/companies.repository.js';
import { EmployeeStatusesService } from '../employee-statuses/employee-statuses.service.js';
import { PermissionGroupsRepository } from '../permission-groups/permission-groups.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'op@veloxdesk.local',
    passwordHash: 'old-hash',
    fullName: 'Оператор',
    role: UserRole.OPERATOR,
    cannotManageAdmins: false,
    permissionGroupId: null,
    refreshTokenHash: 'some-hash',
    deletedAt: undefined,
    authProvider: AuthProvider.LOCAL,
    ...overrides,
  };
}

function makeActor(overrides: Partial<Record<string, unknown>> = {}) {
  return { sub: 'admin-1', email: 'admin@veloxdesk.local', role: UserRole.ADMIN, ...overrides };
}

describe('UsersService.resetPasswordByAdmin', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'updatePasswordHash' | 'setRefreshTokenHash'>>;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds'>>;
  let totpService: { verifyCode: jest.Mock };
  let totpEncryptionService: { decrypt: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn(),
      updatePasswordHash: jest.fn(),
      setRefreshTokenHash: jest.fn(),
    };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    totpService = { verifyCode: jest.fn() };
    totpEncryptionService = { decrypt: jest.fn() };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      totpService as never,
      totpEncryptionService as never,
    );
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'new-hash');
  });

  it('throws for a nonexistent user', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(service.resetPasswordByAdmin('missing', 'a-strong-password', makeActor() as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('hashes the new password and persists it — resetting someone ELSE\'s password needs no re-auth', async () => {
    usersRepository.findById.mockResolvedValue(makeUser() as never);
    await service.resetPasswordByAdmin('user-1', 'a-strong-password', makeActor() as never);
    expect(bcrypt.hash).toHaveBeenCalledWith('a-strong-password', 12);
    expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith('user-1', 'new-hash');
  });

  it('revokes the existing refresh token — a password reset ends current sessions too', async () => {
    usersRepository.findById.mockResolvedValue(makeUser() as never);
    await service.resetPasswordByAdmin('user-1', 'a-strong-password', makeActor() as never);
    expect(usersRepository.setRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
  });

  describe('self-targeting (id === actor.sub) — closes the stolen-token durable-takeover hole', () => {
    it('rejects with no currentPassword at all', async () => {
      usersRepository.findById.mockResolvedValue(makeUser({ id: 'admin-1' }) as never);
      await expect(
        service.resetPasswordByAdmin('admin-1', 'a-strong-password', makeActor() as never),
      ).rejects.toThrow('Неверный текущий пароль');
      expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects a wrong currentPassword', async () => {
      usersRepository.findById.mockResolvedValue(makeUser({ id: 'admin-1' }) as never);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      await expect(
        service.resetPasswordByAdmin('admin-1', 'a-strong-password', makeActor() as never, 'wrong-password'),
      ).rejects.toThrow('Неверный текущий пароль');
      expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('accepts the correct currentPassword when 2FA is not enabled', async () => {
      usersRepository.findById.mockResolvedValue(makeUser({ id: 'admin-1' }) as never);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      await expect(
        service.resetPasswordByAdmin('admin-1', 'a-strong-password', makeActor() as never, 'correct-password'),
      ).resolves.toBeDefined();
      expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith('admin-1', 'new-hash');
    });

    it('additionally requires a valid TOTP code when 2FA is enabled', async () => {
      usersRepository.findById.mockResolvedValue(
        makeUser({ id: 'admin-1', twoFactorEnabled: true, totpSecretEncrypted: 'enc-secret' }) as never,
      );
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      totpEncryptionService.decrypt.mockReturnValue('plain-secret');
      totpService.verifyCode.mockReturnValue(false);

      await expect(
        service.resetPasswordByAdmin('admin-1', 'a-strong-password', makeActor() as never, 'correct-password', '000000'),
      ).rejects.toThrow('Неверный код подтверждения');
      expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();

      totpService.verifyCode.mockReturnValue(true);
      await expect(
        service.resetPasswordByAdmin('admin-1', 'a-strong-password', makeActor() as never, 'correct-password', '123456'),
      ).resolves.toBeDefined();
      expect(totpEncryptionService.decrypt).toHaveBeenCalledWith('enc-secret');
      expect(totpService.verifyCode).toHaveBeenCalledWith('plain-secret', '123456');
    });
  });
});

describe('UsersService.resetTwoFactorByAdmin', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'setTwoFactor'>>;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds'>>;
  let totpService: { verifyCode: jest.Mock };
  let totpEncryptionService: { decrypt: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn(),
      setTwoFactor: jest.fn(),
    };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    totpService = { verifyCode: jest.fn() };
    totpEncryptionService = { decrypt: jest.fn() };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      totpService as never,
      totpEncryptionService as never,
    );
  });

  it('resets someone ELSE\'s 2FA with no re-auth — the account-recovery path stays open', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ twoFactorEnabled: true }) as never);
    await service.resetTwoFactorByAdmin('user-1', makeActor() as never);
    expect(usersRepository.setTwoFactor).toHaveBeenCalledWith('user-1', {
      totpSecretEncrypted: null,
      twoFactorEnabled: false,
    });
  });

  it('rejects self-targeting with no currentPassword', async () => {
    usersRepository.findById.mockResolvedValue(
      makeUser({ id: 'admin-1', twoFactorEnabled: true, totpSecretEncrypted: 'enc-secret' }) as never,
    );
    await expect(service.resetTwoFactorByAdmin('admin-1', makeActor() as never)).rejects.toThrow(
      'Неверный текущий пароль',
    );
    expect(usersRepository.setTwoFactor).not.toHaveBeenCalled();
  });

  it('rejects self-targeting with the correct password but a wrong/missing TOTP code — stripping your OWN 2FA needs proving you still have it', async () => {
    usersRepository.findById.mockResolvedValue(
      makeUser({ id: 'admin-1', twoFactorEnabled: true, totpSecretEncrypted: 'enc-secret' }) as never,
    );
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    totpEncryptionService.decrypt.mockReturnValue('plain-secret');
    totpService.verifyCode.mockReturnValue(false);

    await expect(
      service.resetTwoFactorByAdmin('admin-1', makeActor() as never, 'correct-password', '000000'),
    ).rejects.toThrow('Неверный код подтверждения');
    expect(usersRepository.setTwoFactor).not.toHaveBeenCalled();
  });

  it('accepts self-targeting with the correct password and a valid TOTP code', async () => {
    usersRepository.findById.mockResolvedValue(
      makeUser({ id: 'admin-1', twoFactorEnabled: true, totpSecretEncrypted: 'enc-secret' }) as never,
    );
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    totpEncryptionService.decrypt.mockReturnValue('plain-secret');
    totpService.verifyCode.mockReturnValue(true);

    await expect(
      service.resetTwoFactorByAdmin('admin-1', makeActor() as never, 'correct-password', '123456'),
    ).resolves.toBeDefined();
    expect(usersRepository.setTwoFactor).toHaveBeenCalledWith('admin-1', {
      totpSecretEncrypted: null,
      twoFactorEnabled: false,
    });
  });
});

describe('UsersService.changeOwnPassword', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'updatePasswordHash' | 'setRefreshTokenHash'>>;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds'>>;
  let totpService: { verifyCode: jest.Mock };
  let totpEncryptionService: { decrypt: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn(),
      updatePasswordHash: jest.fn(),
      setRefreshTokenHash: jest.fn(),
    };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    totpService = { verifyCode: jest.fn() };
    totpEncryptionService = { decrypt: jest.fn() };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      totpService as never,
      totpEncryptionService as never,
    );
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'new-hash');
  });

  // No id param on this method at all — it's always self-targeting by
  // construction (see updateOwnProfile/completeProfile for the same
  // shape), so there's no "resets someone else's password" case to test
  // here the way resetPasswordByAdmin has one.

  it('throws for a nonexistent actor', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(
      service.changeOwnPassword(makeActor() as never, 'current-password', 'a-strong-password'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects with no currentPassword', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ id: 'admin-1' }) as never);
    await expect(service.changeOwnPassword(makeActor() as never, '', 'a-strong-password')).rejects.toThrow(
      'Неверный текущий пароль',
    );
    expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('rejects a wrong currentPassword', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ id: 'admin-1' }) as never);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    await expect(
      service.changeOwnPassword(makeActor() as never, 'wrong-password', 'a-strong-password'),
    ).rejects.toThrow('Неверный текущий пароль');
    expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('hashes and persists the new password, and revokes the refresh token, when 2FA is not enabled', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ id: 'admin-1' }) as never);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    await service.changeOwnPassword(makeActor() as never, 'correct-password', 'a-strong-password');
    expect(bcrypt.hash).toHaveBeenCalledWith('a-strong-password', 12);
    expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith('admin-1', 'new-hash');
    expect(usersRepository.setRefreshTokenHash).toHaveBeenCalledWith('admin-1', null);
  });

  it('additionally requires a valid TOTP code when 2FA is enabled — closes it for a client/operator too, not just admin', async () => {
    usersRepository.findById.mockResolvedValue(
      makeUser({ id: 'client-1', role: UserRole.CLIENT, twoFactorEnabled: true, totpSecretEncrypted: 'enc-secret' }) as never,
    );
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    totpEncryptionService.decrypt.mockReturnValue('plain-secret');
    totpService.verifyCode.mockReturnValue(false);

    await expect(
      service.changeOwnPassword(makeActor({ sub: 'client-1' }) as never, 'correct-password', 'a-strong-password', '000000'),
    ).rejects.toThrow('Неверный код подтверждения');
    expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();

    totpService.verifyCode.mockReturnValue(true);
    await expect(
      service.changeOwnPassword(makeActor({ sub: 'client-1' }) as never, 'correct-password', 'a-strong-password', '123456'),
    ).resolves.toBeUndefined();
    expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith('client-1', 'new-hash');
  });
});

describe('UsersService.completeProfile', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'updateProfile'>>;
  let companiesRepository: jest.Mocked<Pick<CompaniesRepository, 'findByName'>>;
  let citiesRepository: jest.Mocked<Pick<CitiesRepository, 'findByName'>>;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn().mockResolvedValue(makeUser({ role: UserRole.CLIENT })),
      updateProfile: jest.fn(),
    };
    const permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    // Simulates "the submitted company/city is already a real catalog
    // entry" — matches the `dto` below, which every test here reuses as-is.
    // Individual tests override these per-call to exercise the rejection path.
    companiesRepository = { findByName: jest.fn().mockResolvedValue({ id: 'company-1', name: 'ООО Ромашка' }) };
    citiesRepository = { findByName: jest.fn().mockResolvedValue({ id: 'city-1', name: 'Киев' }) };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      companiesRepository as never,
      citiesRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };
  const dto = { position: 'Менеджер', department: 'Продажи', company: 'ООО Ромашка', city: 'Киев', phone: '+380000000000' };

  it('throws for a nonexistent user', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(service.completeProfile(actor as never, dto)).rejects.toThrow(NotFoundException);
  });

  it('stamps profileCompletedAt and saves every required field', async () => {
    await service.completeProfile(actor as never, dto);
    expect(usersRepository.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        position: 'Менеджер',
        department: 'Продажи',
        company: 'ООО Ромашка',
        city: 'Киев',
        phone: '+380000000000',
        computerName: null,
        profileCompletedAt: expect.any(Date),
      }),
    );
  });

  it('uppercases computerName is left to the frontend — backend stores whatever it receives', async () => {
    await service.completeProfile(actor as never, { ...dto, computerName: 'desk-01' });
    expect(usersRepository.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ computerName: 'desk-01' }),
    );
  });

  it('rejects a company that is not in the admin-managed catalog', async () => {
    companiesRepository.findByName.mockResolvedValue(null);
    await expect(
      service.completeProfile(actor as never, { ...dto, company: 'Несуществующая компания' }),
    ).rejects.toThrow(BadRequestException);
    expect(usersRepository.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects a city that is not in the admin-managed catalog', async () => {
    citiesRepository.findByName.mockResolvedValue(null);
    await expect(service.completeProfile(actor as never, { ...dto, city: 'Несуществующий город' })).rejects.toThrow(
      BadRequestException,
    );
    expect(usersRepository.updateProfile).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateProfile — company/city catalog validation', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'updateProfile'>>;
  let companiesRepository: jest.Mocked<Pick<CompaniesRepository, 'findByName'>>;
  let citiesRepository: jest.Mocked<Pick<CitiesRepository, 'findByName'>>;
  let service: UsersService;

  // Stored value predates the catalog — no matching row for it.
  const existingUser = makeUser({ role: UserRole.CLIENT, company: 'Старая Компания Инк', city: 'Старгород' });

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn().mockResolvedValue(existingUser),
      updateProfile: jest.fn(),
    };
    const permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    companiesRepository = { findByName: jest.fn().mockResolvedValue(null) };
    citiesRepository = { findByName: jest.fn().mockResolvedValue(null) };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      companiesRepository as never,
      citiesRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  const actor = makeActor();

  it('does not re-validate an unchanged company/city, even if it predates the catalog', async () => {
    await service.updateProfile('user-1', { fullName: 'Новое Имя', company: 'Старая Компания Инк', city: 'Старгород' }, actor as never);
    expect(companiesRepository.findByName).not.toHaveBeenCalled();
    expect(citiesRepository.findByName).not.toHaveBeenCalled();
    expect(usersRepository.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ fullName: 'Новое Имя' }),
    );
  });

  it('does not re-validate when company/city are omitted from the request entirely', async () => {
    await service.updateProfile('user-1', { fullName: 'Новое Имя' }, actor as never);
    expect(companiesRepository.findByName).not.toHaveBeenCalled();
    expect(citiesRepository.findByName).not.toHaveBeenCalled();
  });

  it('rejects changing company to a value that is not in the catalog', async () => {
    await expect(
      service.updateProfile('user-1', { company: 'Совсем Другая Компания' }, actor as never),
    ).rejects.toThrow(BadRequestException);
    expect(usersRepository.updateProfile).not.toHaveBeenCalled();
  });

  it('accepts changing company to a value that is in the catalog', async () => {
    companiesRepository.findByName.mockResolvedValue({ id: 'company-2', name: 'Новая Компания' } as never);
    await service.updateProfile('user-1', { company: 'Новая Компания' }, actor as never);
    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({ company: 'Новая Компания' }));
  });
});

describe('UsersService — restricted admin (cannotManageAdmins)', () => {
  const restrictedActor = { sub: 'restricted-admin', email: 'restricted@veloxdesk.local', role: UserRole.ADMIN };
  const normalActor = { sub: 'normal-admin', email: 'normal@veloxdesk.local', role: UserRole.ADMIN };
  const restrictedAdminUser = makeUser({ id: 'restricted-admin', role: UserRole.ADMIN, cannotManageAdmins: true });
  const normalAdminUser = makeUser({ id: 'normal-admin', role: UserRole.ADMIN, cannotManageAdmins: false });
  const otherAdminUser = makeUser({ id: 'other-admin', role: UserRole.ADMIN, cannotManageAdmins: false });
  const operatorUser = makeUser({ id: 'operator-1', role: UserRole.OPERATOR, cannotManageAdmins: false });

  const usersById: Record<string, ReturnType<typeof makeUser>> = {
    'restricted-admin': restrictedAdminUser,
    'normal-admin': normalAdminUser,
    'other-admin': otherAdminUser,
    'operator-1': operatorUser,
  };

  let usersRepository: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findById'
      | 'findByEmail'
      | 'create'
      | 'updateRole'
      | 'updateAdminRestriction'
      | 'updateProfile'
      | 'updatePermissionGroup'
      | 'updatePasswordHash'
      | 'setRefreshTokenHash'
      | 'deactivate'
      | 'reactivate'
      | 'setTwoFactor'
    >
  >;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds'>>;
  let teamsService: jest.Mocked<Pick<TeamsService, 'getTeamIdForUser' | 'assignUserTeam'>>;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn((id: string) => Promise.resolve(usersById[id] ?? null)) as never,
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: unknown) => Promise.resolve({ id: 'new-user', ...(data as object) })) as never,
      updateRole: jest.fn(),
      updateAdminRestriction: jest.fn(),
      updateProfile: jest.fn(),
      updatePermissionGroup: jest.fn(),
      updatePasswordHash: jest.fn(),
      setRefreshTokenHash: jest.fn(),
      deactivate: jest.fn(),
      reactivate: jest.fn(),
      setTwoFactor: jest.fn(),
    };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    teamsService = {
      getTeamIdForUser: jest.fn().mockResolvedValue(null),
      assignUserTeam: jest.fn().mockResolvedValue(undefined),
    };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'new-hash');
  });

  it('blocks creating a new ADMIN account', async () => {
    await expect(
      service.createByAdmin(
        { email: 'x@x.com', password: 'a-strong-password', fullName: 'X', role: UserRole.ADMIN },
        restrictedActor as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows creating a non-admin account', async () => {
    await expect(
      service.createByAdmin(
        { email: 'x@x.com', password: 'a-strong-password', fullName: 'X', role: UserRole.OPERATOR },
        restrictedActor as never,
      ),
    ).resolves.toBeDefined();
    // Regression: email has a global unique index, not partial on
    // deleted_at IS NULL — the pre-check must include soft-deleted rows or
    // it misses a deactivated user's email, passes the friendly guard, and
    // lets the INSERT below hit a raw Postgres unique-violation instead.
    expect(usersRepository.findByEmail).toHaveBeenCalledWith('x@x.com', { withDeleted: true });
  });

  it('blocks promoting an existing user to ADMIN', async () => {
    await expect(service.updateRole('operator-1', UserRole.ADMIN, restrictedActor as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('blocks changing an existing admin\'s role', async () => {
    await expect(service.updateRole('other-admin', UserRole.OPERATOR, restrictedActor as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows changing a non-admin\'s role', async () => {
    await expect(service.updateRole('operator-1', UserRole.CLIENT, restrictedActor as never)).resolves.toBeDefined();
  });

  // Regression: a role/permission-group/admin-restriction change used to
  // leave the target's already-issued access token (and any live socket)
  // fully valid with its OLD claims — the same bug class already fixed for
  // deactivate(), just never applied to these three. Each must now null the
  // refresh token (blocks a silent future refresh) and publish
  // account_security_changed (kicks any live socket right away).
  it('forces reauth after a role change', async () => {
    await service.updateRole('operator-1', UserRole.CLIENT, restrictedActor as never);
    expect(usersRepository.setRefreshTokenHash).toHaveBeenCalledWith('operator-1', null);
  });

  // Regression: team membership only makes sense for staff — demoting to
  // CLIENT used to leave a stale TeamMemberEntity row in place forever,
  // since nothing else ever touches it once the account is no longer staff.
  it('clears team membership when demoting an operator to client', async () => {
    await service.updateRole('operator-1', UserRole.CLIENT, restrictedActor as never);
    expect(teamsService.assignUserTeam).toHaveBeenCalledWith('operator-1', null);
  });

  it('forces reauth after an admin-restriction change', async () => {
    await service.setAdminRestriction('restricted-admin', false, normalActor as never);
    expect(usersRepository.setRefreshTokenHash).toHaveBeenCalledWith('restricted-admin', null);
  });

  // Regression: assignTeam was the one mutation here still missing
  // forceReauth — a department change stayed live in an already-issued
  // access token (restrictToDepartments scoping) for its full TTL, unlike
  // every sibling mutation in this describe block.
  it('forces reauth after a team assignment change', async () => {
    await service.assignTeam('operator-1', 'team-2', normalActor as never);
    expect(usersRepository.setRefreshTokenHash).toHaveBeenCalledWith('operator-1', null);
  });

  it('forces reauth after a permission-group assignment change', async () => {
    await service.assignPermissionGroup('operator-1', null, normalActor as never);
    expect(usersRepository.setRefreshTokenHash).toHaveBeenCalledWith('operator-1', null);
  });

  it('blocks resetting another admin\'s password', async () => {
    await expect(
      service.resetPasswordByAdmin('other-admin', 'a-strong-password', restrictedActor as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks deactivating another admin', async () => {
    await expect(service.deactivate('other-admin', restrictedActor as never)).rejects.toThrow(ForbiddenException);
  });

  it('blocks reactivating another admin', async () => {
    await expect(service.reactivate('other-admin', restrictedActor as never)).rejects.toThrow(ForbiddenException);
  });

  it('blocks resetting another admin\'s 2FA', async () => {
    await expect(service.resetTwoFactorByAdmin('other-admin', restrictedActor as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('blocks editing another admin\'s profile', async () => {
    await expect(
      service.updateProfile('other-admin', { fullName: 'New Name' }, restrictedActor as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks assigning a permission group to another admin', async () => {
    await expect(service.assignPermissionGroup('other-admin', null, restrictedActor as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('blocks assigning a team to another admin', async () => {
    await expect(service.assignTeam('other-admin', null, restrictedActor as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('blocks toggling another admin\'s own restriction flag', async () => {
    await expect(service.setAdminRestriction('other-admin', true, restrictedActor as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // Regression: assertAdminActionAllowed exempts self-targeting so a
  // restricted admin can still edit their own profile/password/2FA — but
  // setAdminRestriction is a privilege-escalation vector, not a normal
  // self-edit. Without a dedicated check, a restricted admin could clear
  // their OWN flag via this exact path and become a full admin.
  it('blocks a restricted admin from clearing their own restriction flag', async () => {
    await expect(
      service.setAdminRestriction('restricted-admin', false, restrictedActor as never),
    ).rejects.toThrow(BadRequestException);
    expect(usersRepository.updateAdminRestriction).not.toHaveBeenCalled();
  });

  it('blocks even an unrestricted admin from touching their own restriction flag', async () => {
    await expect(service.setAdminRestriction('normal-admin', true, normalActor as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('still allows managing itself (own profile, password, 2FA), given the correct current password', async () => {
    // restrictedAdminUser has no twoFactorEnabled override (falsy), so only
    // the current-password check applies here — see the dedicated
    // assertSelfReauth describe block below for the 2FA-enabled case.
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await expect(
      service.updateProfile('restricted-admin', { fullName: 'Self' }, restrictedActor as never),
    ).resolves.toBeDefined();
    await expect(
      service.resetPasswordByAdmin(
        'restricted-admin',
        'a-strong-password',
        restrictedActor as never,
        'correct-current-password',
      ),
    ).resolves.toBeDefined();
    await expect(
      service.resetTwoFactorByAdmin('restricted-admin', restrictedActor as never, 'correct-current-password'),
    ).resolves.toBeDefined();
  });

  it('blocks self-resetting password/2FA without the current password', async () => {
    await expect(
      service.resetPasswordByAdmin('restricted-admin', 'a-strong-password', restrictedActor as never),
    ).rejects.toThrow('Неверный текущий пароль');
    await expect(service.resetTwoFactorByAdmin('restricted-admin', restrictedActor as never)).rejects.toThrow(
      'Неверный текущий пароль',
    );
  });

  it('freely manages operators/clients — no restriction outside admin targets', async () => {
    await expect(
      service.updateProfile('operator-1', { fullName: 'Updated' }, restrictedActor as never),
    ).resolves.toBeDefined();
    await expect(
      service.resetPasswordByAdmin('operator-1', 'a-strong-password', restrictedActor as never),
    ).resolves.toBeDefined();
    await expect(service.deactivate('operator-1', restrictedActor as never)).resolves.toBeDefined();
  });

  it('a normal (unrestricted) admin can fully manage a restricted admin\'s account', async () => {
    await expect(
      service.resetPasswordByAdmin('restricted-admin', 'a-strong-password', normalActor as never),
    ).resolves.toBeDefined();
    await expect(service.deactivate('restricted-admin', normalActor as never)).resolves.toBeDefined();
    await expect(
      service.setAdminRestriction('restricted-admin', false, normalActor as never),
    ).resolves.toBeDefined();
  });
});

describe('UsersService.updateOwnProfile', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'updateProfile'>>;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds'>>;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = { findById: jest.fn().mockResolvedValue(makeUser()), updateProfile: jest.fn() };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('updates only computerName for the acting user, self-service', async () => {
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await service.updateOwnProfile(actor as never, { computerName: 'DESKTOP-A1B2' });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', { computerName: 'DESKTOP-A1B2' });
  });

  it('clears computerName to null on an empty string when it was never set', async () => {
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await service.updateOwnProfile(actor as never, { computerName: '' });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', { computerName: null });
  });

  it('rejects clearing computerName once it has already been filled in', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ computerName: 'DESKTOP-A1B2' }) as never);
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await expect(service.updateOwnProfile(actor as never, { computerName: '' })).rejects.toThrow(
      BadRequestException,
    );
    expect(usersRepository.updateProfile).not.toHaveBeenCalled();
  });

  it('updates only phone for the acting user, self-service', async () => {
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await service.updateOwnProfile(actor as never, { phone: '+380501234567' });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', { phone: '+380501234567' });
  });

  it('clears phone to null on an empty string when it was never set', async () => {
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await service.updateOwnProfile(actor as never, { phone: '' });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', { phone: null });
  });

  it('rejects clearing phone once it has already been filled in', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ phone: '+380501234567' }) as never);
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await expect(service.updateOwnProfile(actor as never, { phone: '' })).rejects.toThrow(BadRequestException);
    expect(usersRepository.updateProfile).not.toHaveBeenCalled();
  });

  it('never touches org-managed fields — the DTO has no way to send them', async () => {
    const actor = { sub: 'user-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await service.updateOwnProfile(actor as never, {});

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', {});
  });

  it('updates locale independently of computerName', async () => {
    const actor = { sub: 'user-1', email: 'operator@veloxdesk.local', role: UserRole.OPERATOR };

    await service.updateOwnProfile(actor as never, { locale: Locale.UK });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', { locale: Locale.UK });
  });

  it('saves both fields together when both are sent', async () => {
    const actor = { sub: 'user-1', email: 'operator@veloxdesk.local', role: UserRole.OPERATOR };

    await service.updateOwnProfile(actor as never, { computerName: 'DESKTOP-A1B2', locale: Locale.EN });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', {
      computerName: 'DESKTOP-A1B2',
      locale: Locale.EN,
    });
  });
});

describe('UsersService.setVip', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'setVip'>>;
  let permissionGroupsRepository: jest.Mocked<Pick<PermissionGroupsRepository, 'findFlagsByGroupIds'>>;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn(),
      setVip: jest.fn(),
    };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    const teamsService = { getTeamIdForUser: jest.fn().mockResolvedValue(null) };
    const userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as unknown as PermissionGroupsRepository,
      {} as unknown as EmployeeStatusesService,
      teamsService as unknown as TeamsService,
      userEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('throws for a nonexistent user', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(service.setVip('missing', true)).rejects.toThrow(NotFoundException);
  });

  it('rejects toggling VIP on a non-client account', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ role: UserRole.OPERATOR }) as never);
    await expect(service.setVip('user-1', true)).rejects.toThrow(BadRequestException);
    expect(usersRepository.setVip).not.toHaveBeenCalled();
  });

  it('sets VIP on a client account', async () => {
    usersRepository.findById.mockResolvedValue(makeUser({ role: UserRole.CLIENT, isVip: false }) as never);
    const result = await service.setVip('user-1', true);
    expect(usersRepository.setVip).toHaveBeenCalledWith('user-1', true);
    expect(result.isVip).toBe(true);
  });
});

describe('UsersService.provisionFromDirectory', () => {
  let usersRepository: jest.Mocked<
    Pick<UsersRepository, 'findByAuthProviderAndExternalId' | 'findByEmail' | 'linkToDirectory' | 'create'>
  >;
  let service: UsersService;

  const identity = { externalId: 'guid-1', email: 'directory-user@corp.local', fullName: 'Directory User' };

  beforeEach(() => {
    usersRepository = {
      findByAuthProviderAndExternalId: jest.fn(),
      findByEmail: jest.fn(),
      linkToDirectory: jest.fn(),
      create: jest.fn(),
    };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('reuses the existing account on a repeat login, matched by (authProvider, externalId)', async () => {
    const existing = makeUser({ id: 'user-1', authProvider: AuthProvider.LDAP, externalId: 'guid-1' });
    usersRepository.findByAuthProviderAndExternalId.mockResolvedValue(existing as never);

    const result = await service.provisionFromDirectory(identity, AuthProvider.LDAP, UserRole.OPERATOR);

    expect(result).toBe(existing);
    expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('links a pre-existing LOCAL account with the same email instead of creating a duplicate, and clears its local password', async () => {
    usersRepository.findByAuthProviderAndExternalId.mockResolvedValue(null);
    const localAccount = makeUser({ id: 'user-2', email: identity.email, authProvider: AuthProvider.LOCAL });
    usersRepository.findByEmail.mockResolvedValue(localAccount as never);

    const result = await service.provisionFromDirectory(identity, AuthProvider.LDAP, UserRole.OPERATOR);

    expect(usersRepository.linkToDirectory).toHaveBeenCalledWith('user-2', AuthProvider.LDAP, 'guid-1');
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(result.authProvider).toBe(AuthProvider.LDAP);
    expect(result.passwordHash).toBeNull();
  });

  it('creates a brand-new, immediately-approved account when neither externalId nor email match anything', async () => {
    usersRepository.findByAuthProviderAndExternalId.mockResolvedValue(null);
    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.create.mockResolvedValue(makeUser({ id: 'new-user', ...identity }) as never);

    await service.provisionFromDirectory(identity, AuthProvider.OIDC, UserRole.CLIENT);

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: identity.email,
        fullName: identity.fullName,
        passwordHash: null,
        role: UserRole.CLIENT,
        authProvider: AuthProvider.OIDC,
        externalId: identity.externalId,
        approvedAt: expect.any(Date),
      }),
    );
  });
});
