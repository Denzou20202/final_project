import { UserEntity } from '@veloxdesk/database';
import { AuthProvider, Locale, UserRole } from '@veloxdesk/types';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  // Meaningful only when role = ADMIN — see UserEntity.cannotManageAdmins.
  cannotManageAdmins: boolean;
  // Meaningful only when role = CLIENT — see UserEntity.isVip.
  isVip: boolean;
  locale: Locale;
  computerName: string | null;
  position: string | null;
  department: string | null;
  company: string | null;
  city: string | null;
  phone: string | null;
  // Deactivated (soft-deleted, see UsersRepository.deactivate) rather than
  // actually missing — null means active. Every admin-facing user list
  // fetches withDeleted so these accounts still show up (with a badge).
  deactivatedAt: Date | null;
  permissionGroupId: string | null;
  // False only when the user's group has cannotBeAssignee=true ("наблюдатель")
  // — computed here (not stored) since it depends on the group, not the user
  // row itself. Assignee pickers filter on this.
  canBeAssignee: boolean;
  // Real team membership (TeamMemberEntity), not a stored column — resolved
  // per-user (or batched, for a list) via TeamsService. A user can technically
  // belong to several teams, but EditUserModal's single-select «Отдел»
  // dropdown only shows/sets one, so this is just the first membership found.
  teamId: string | null;
  twoFactorEnabled: boolean;
  // Whether this account has a Telegram chat bound (see
  // UserEntity.telegramChatId / TelegramUserResolverService.linkByToken) —
  // computed, not the raw chat id itself, same reasoning as canBeAssignee.
  telegramLinked: boolean;
  // The employee's manually-picked custom status id, or null for the
  // default «Онлайн» — see EmployeeStatusEntity. The frontend resolves this
  // against the catalog it already fetches for the status picker, so no
  // name/color is denormalized onto PublicUser itself.
  currentStatusId: string | null;
  createdAt: Date;
  // Set when this contact was merged into another one as a duplicate (see
  // ContactsService.merge) — null for every normal, non-merged account.
  mergedIntoId: string | null;
  // Null = awaiting admin approval (self-registration only — see
  // UsersController's pending/approve/reject endpoints). Non-null for every
  // admin-created and every pre-existing (backfilled) account.
  approvedAt: Date | null;
  // Null = hasn't completed the mandatory client-onboarding form yet — see
  // UsersService.completeProfile. Non-null for every pre-existing
  // (backfilled) account, so only a freshly self-registered client is ever
  // gated by it.
  profileCompletedAt: Date | null;
  // 'local' = has a password, changeable via the normal change-password UI.
  // 'ldap'/'oidc' = directory-provisioned/linked (see UserEntity
  // .authProvider) — the frontend hides the change-password form and shows
  // "managed by your organization's directory" instead.
  authProvider: AuthProvider;
}

export interface PublicUserPage {
  items: PublicUser[];
  nextCursor: string | null;
}

export function toPublicUser(user: UserEntity, groupCannotBeAssignee = false, teamId: string | null = null): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    cannotManageAdmins: user.cannotManageAdmins,
    isVip: user.isVip,
    locale: user.locale,
    computerName: user.computerName ?? null,
    position: user.position ?? null,
    department: user.department ?? null,
    company: user.company ?? null,
    city: user.city ?? null,
    phone: user.phone ?? null,
    deactivatedAt: user.deletedAt ?? null,
    permissionGroupId: user.permissionGroupId ?? null,
    canBeAssignee: !user.permissionGroupId || !groupCannotBeAssignee,
    twoFactorEnabled: user.twoFactorEnabled,
    telegramLinked: !!user.telegramChatId,
    currentStatusId: user.currentStatusId ?? null,
    teamId,
    createdAt: user.createdAt,
    mergedIntoId: user.mergedIntoId ?? null,
    approvedAt: user.approvedAt ?? null,
    profileCompletedAt: user.profileCompletedAt ?? null,
    authProvider: user.authProvider,
  };
}
