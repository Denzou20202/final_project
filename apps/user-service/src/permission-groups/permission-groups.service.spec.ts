import { SettingsAuditLogService } from '@veloxdesk/common';
import { PermissionGroupsRepository } from './permission-groups.repository.js';
import { PermissionGroupsService } from './permission-groups.service.js';
import { UserEventsPublisherService } from '../user-events/user-events-publisher.service.js';

const actor = { sub: 'admin-1', email: 'admin@veloxdesk.local', role: 'admin' };

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    name: 'Test group',
    restrictToDepartments: false,
    restrictToOwnTickets: false,
    cannotBeAssignee: false,
    requireTwoFactor: false,
    ipWhitelist: [],
    ...overrides,
  };
}

// Regression coverage for the group-level session-invalidation bug: a
// permission group's policy fields (restrictToDepartments/
// restrictToOwnTickets/requireTwoFactor/ipWhitelist/departmentIds) are
// baked into every member's JwtPayload at login (see AuthService.
// issueTokens) — changing the group, or deleting it outright, used to
// leave every member's already-issued token and any live socket fully
// valid with the OLD claims. update()/remove() must now force every
// current member through a fresh login.
describe('PermissionGroupsService — member session invalidation', () => {
  let repository: jest.Mocked<
    Pick<
      PermissionGroupsRepository,
      | 'findById'
      | 'update'
      | 'delete'
      | 'setDepartments'
      | 'findDepartmentIds'
      | 'countMembers'
      | 'findMemberIds'
      | 'clearRefreshTokensForUserIds'
      | 'hasAdminMember'
      | 'isRestrictedAdmin'
    >
  >;
  let userEventsPublisher: jest.Mocked<Pick<UserEventsPublisherService, 'publish'>>;
  let service: PermissionGroupsService;

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(makeGroup()),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      setDepartments: jest.fn().mockResolvedValue(undefined),
      findDepartmentIds: jest.fn().mockResolvedValue([]),
      countMembers: jest.fn().mockResolvedValue(2),
      findMemberIds: jest.fn().mockResolvedValue(['member-1', 'member-2']),
      clearRefreshTokensForUserIds: jest.fn().mockResolvedValue(undefined),
      hasAdminMember: jest.fn().mockResolvedValue(false),
      isRestrictedAdmin: jest.fn().mockResolvedValue(false),
    };
    userEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    // Only the "departmentIds changes" test below exercises this path,
    // always with exactly one id ('team-1') — a fixed one-team response
    // satisfies validateDepartmentIds' length check without needing to
    // inspect TypeORM's In() operator internals.
    const teamsRepository = { find: jest.fn().mockResolvedValue([{ id: 'team-1' }]) };
    service = new PermissionGroupsService(
      repository as unknown as PermissionGroupsRepository,
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as SettingsAuditLogService,
      teamsRepository as never,
      userEventsPublisher as unknown as UserEventsPublisherService,
    );
  });

  it('forces reauth for every current member when a policy field changes', async () => {
    await service.update('group-1', { requireTwoFactor: true }, actor as never);

    expect(repository.clearRefreshTokensForUserIds).toHaveBeenCalledWith(['member-1', 'member-2']);
    expect(userEventsPublisher.publish).toHaveBeenCalledWith({ type: 'account_security_changed', userId: 'member-1' });
    expect(userEventsPublisher.publish).toHaveBeenCalledWith({ type: 'account_security_changed', userId: 'member-2' });
  });

  it('forces reauth when only departmentIds changes (a separate write path from `patch`)', async () => {
    await service.update('group-1', { departmentIds: ['team-1'] }, actor as never);
    expect(repository.clearRefreshTokensForUserIds).toHaveBeenCalledWith(['member-1', 'member-2']);
  });

  it('skips reauth entirely for an empty group (no members to reach)', async () => {
    repository.findMemberIds.mockResolvedValue([]);
    await service.update('group-1', { requireTwoFactor: true }, actor as never);
    expect(repository.clearRefreshTokensForUserIds).not.toHaveBeenCalled();
    expect(userEventsPublisher.publish).not.toHaveBeenCalled();
  });

  it('forces reauth for every member on group deletion (captured before the FK cascade clears permission_group_id)', async () => {
    await service.remove('group-1', actor as never);

    expect(repository.findMemberIds).toHaveBeenCalledWith('group-1');
    expect(repository.delete).toHaveBeenCalledWith('group-1');
    expect(repository.clearRefreshTokensForUserIds).toHaveBeenCalledWith(['member-1', 'member-2']);
  });
});

// Regression coverage for the self-escalation hole: editing/deleting a
// group had no self-check and no admin-hierarchy check at all, unlike every
// other endpoint that touches the same policy fields (assignPermissionGroup,
// setAdminRestriction). A restricted admin who was a member of their own
// 2FA-required/department-restricted group could strip those restrictions
// from themselves with zero re-authentication, either by editing the group
// or deleting it outright (FK ON DELETE SET NULL clears permission_group_id
// for every member, including the actor).
describe('PermissionGroupsService — self-escalation guard', () => {
  let repository: jest.Mocked<
    Pick<
      PermissionGroupsRepository,
      | 'findById'
      | 'update'
      | 'delete'
      | 'setDepartments'
      | 'findDepartmentIds'
      | 'countMembers'
      | 'findMemberIds'
      | 'clearRefreshTokensForUserIds'
      | 'hasAdminMember'
      | 'isRestrictedAdmin'
    >
  >;
  let service: PermissionGroupsService;

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(makeGroup()),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      setDepartments: jest.fn().mockResolvedValue(undefined),
      findDepartmentIds: jest.fn().mockResolvedValue([]),
      countMembers: jest.fn().mockResolvedValue(1),
      findMemberIds: jest.fn().mockResolvedValue(['admin-1']),
      clearRefreshTokensForUserIds: jest.fn().mockResolvedValue(undefined),
      hasAdminMember: jest.fn().mockResolvedValue(false),
      isRestrictedAdmin: jest.fn().mockResolvedValue(false),
    };
    service = new PermissionGroupsService(
      repository as unknown as PermissionGroupsRepository,
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as SettingsAuditLogService,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { publish: jest.fn().mockResolvedValue(undefined) } as unknown as UserEventsPublisherService,
    );
  });

  it('rejects update() when the actor is themselves a member of the target group', async () => {
    await expect(service.update('group-1', { requireTwoFactor: false }, actor as never)).rejects.toThrow(
      'Нельзя изменить или удалить группу прав, в которую входите вы сами',
    );
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.clearRefreshTokensForUserIds).not.toHaveBeenCalled();
  });

  it('rejects remove() when the actor is themselves a member of the target group', async () => {
    await expect(service.remove('group-1', actor as never)).rejects.toThrow(
      'Нельзя изменить или удалить группу прав, в которую входите вы сами',
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('rejects update() from a restricted admin when the group counts an ADMIN among its members', async () => {
    repository.findMemberIds.mockResolvedValue(['some-other-admin']);
    repository.hasAdminMember.mockResolvedValue(true);
    repository.isRestrictedAdmin.mockResolvedValue(true);

    await expect(service.update('group-1', { requireTwoFactor: false }, actor as never)).rejects.toThrow(
      'Ограниченный администратор не может управлять учётными записями администраторов',
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('allows an unrestricted admin to edit a group with an ADMIN member, as long as they are not themselves in it', async () => {
    repository.findMemberIds.mockResolvedValue(['some-other-admin']);
    repository.hasAdminMember.mockResolvedValue(true);
    repository.isRestrictedAdmin.mockResolvedValue(false);

    await expect(service.update('group-1', { requireTwoFactor: false }, actor as never)).resolves.toBeDefined();
    expect(repository.update).toHaveBeenCalled();
  });
});
