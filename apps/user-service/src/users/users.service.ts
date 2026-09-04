import type { JwtPayload } from '@veloxdesk/common';
import { decodeCursor, encodeCursor } from '@veloxdesk/common';
import {
  CommentEntity,
  KnowledgeArticleEntity,
  SettingsAuditLogEntity,
  TicketActivityEntity,
  TicketEntity,
  UserEntity,
} from '@veloxdesk/database';
import { AuthProvider, Locale, SYSTEM_USER_ID, UserRole } from '@veloxdesk/types';
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
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { TotpEncryptionService } from '../auth/totp-encryption.service.js';
import { TotpService } from '../auth/totp.service.js';
import { CitiesRepository } from '../cities/cities.repository.js';
import { CompaniesRepository } from '../companies/companies.repository.js';
import { EmployeeStatusesService } from '../employee-statuses/employee-statuses.service.js';
import type { PublicStatusHistoryEntry } from '../employee-statuses/employee-status.public.js';
import { PermissionGroupsRepository } from '../permission-groups/permission-groups.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { UserEventsPublisherService } from '../user-events/user-events-publisher.service.js';
import { AuthenticatedIdentity } from './directory-identity.js';
import { decodeNameCursor, encodeNameCursor } from './name-cursor.js';
import { CompleteProfileDto } from './dto/complete-profile.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';
import { UpdateUserProfileData, UsersRepository } from './users.repository.js';
import { PublicUser, PublicUserPage, toPublicUser } from './user.public.js';

const DEFAULT_PAGE_SIZE = 20;
const PASSWORD_SALT_ROUNDS = 12;
// Postgres error code for a foreign_key_violation — raised by reject()'s
// hard delete when the target already has tickets/comments/etc. attached
// (see UsersService.hardDelete's own comment for the full list of blocking
// FKs to users.id).
const FOREIGN_KEY_VIOLATION = '23503';
const TELEGRAM_LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly permissionGroupsRepository: PermissionGroupsRepository,
    private readonly employeeStatusesService: EmployeeStatusesService,
    private readonly teamsService: TeamsService,
    private readonly userEventsPublisher: UserEventsPublisherService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly companiesRepository: CompaniesRepository,
    private readonly citiesRepository: CitiesRepository,
    private readonly config: ConfigService,
    private readonly totpService: TotpService,
    private readonly totpEncryptionService: TotpEncryptionService,
  ) {}

  // Self-service Telegram linking — see TelegramUserResolverService
  // .linkByToken (ticket-service) for the consuming side. Overwriting any
  // previous unconsumed token is deliberate: it's an implicit
  // single-active-token invalidation, no extra revocation bookkeeping.
  async createTelegramLinkToken(actor: JwtPayload): Promise<{ link: string; expiresAt: Date }> {
    const token = randomBytes(16).toString('base64url');
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS);
    await this.usersRepository.setTelegramLinkToken(actor.sub, token, expiresAt);
    const botUsername = this.config.getOrThrow<string>('TELEGRAM_BOT_USERNAME');
    return { link: `https://t.me/${botUsername}?start=${token}`, expiresAt };
  }

  // Shared by completeProfile/updateProfile — a company/city value is only
  // ever meaningful if it's a real catalog entry (see CompanyEntity/
  // CityEntity's own comments on why the column itself stays a plain
  // string). The frontend already only offers a <select> sourced from these
  // same catalogs, but that alone doesn't stop a direct API call from
  // sending arbitrary text — this closes that gap server-side, the same
  // defense-in-depth reasoning already applied to the KB-article link
  // sanitizer earlier in this project.
  private async assertKnownCompanyAndCity(company?: string | null, city?: string | null): Promise<void> {
    if (company) {
      const match = await this.companiesRepository.findByName(company);
      if (!match) {
        throw new BadRequestException(`Компания «${company}» отсутствует в справочнике`);
      }
    }
    if (city) {
      const match = await this.citiesRepository.findByName(city);
      if (!match) {
        throw new BadRequestException(`Город «${city}» отсутствует в справочнике`);
      }
    }
  }

  // canBeAssignee depends on the user's GROUP, not the user row — resolved
  // here rather than stored, so it's never stale after a group edit. teamId
  // is similarly resolved from TeamMemberEntity rather than stored on the
  // user row (see toPublicUser's own comment).
  private async toPublicUserWithGroup(user: UserEntity): Promise<PublicUser> {
    const [groupCannotBeAssignee, teamId] = await Promise.all([
      user.permissionGroupId
        ? this.permissionGroupsRepository
            .findFlagsByGroupIds([user.permissionGroupId])
            .then((groups) => groups.get(user.permissionGroupId as string)?.cannotBeAssignee ?? false)
        : Promise.resolve(false),
      this.teamsService.getTeamIdForUser(user.id),
    ]);
    return toPublicUser(user, groupCannotBeAssignee, teamId);
  }

  private async toPublicUsersWithGroups(users: UserEntity[]): Promise<PublicUser[]> {
    const groupIds = users.map((u) => u.permissionGroupId).filter((id): id is string => !!id);
    const [groups, teamIds] = await Promise.all([
      this.permissionGroupsRepository.findFlagsByGroupIds(groupIds),
      this.teamsService.getTeamIdsForUsers(users.map((u) => u.id)),
    ]);
    return users.map((user) =>
      toPublicUser(
        user,
        user.permissionGroupId ? (groups.get(user.permissionGroupId)?.cannotBeAssignee ?? false) : false,
        teamIds.get(user.id) ?? null,
      ),
    );
  }

  // Enforces the "restricted admin" rule (see UserEntity.cannotManageAdmins):
  // an actor with the flag set can't touch any user whose CURRENT role is
  // ADMIN (target !== null case), and can't set anyone's role TO admin
  // either (newRole case) — covers both "edit an existing admin" and
  // "promote someone to admin" with one check. A live DB read of the
  // actor's own row, not a JWT claim — these are rare, non-hot-path calls,
  // and a live check means toggling the flag on someone takes effect
  // immediately instead of only after their next token refresh. No-op for
  // an unrestricted actor (the common case) after that one extra read.
  private async assertAdminActionAllowed(
    actor: JwtPayload,
    target: { id: string; role: UserRole } | null,
    newRole?: UserRole,
  ): Promise<void> {
    // Acting on your OWN account is never "managing another admin" — a
    // restricted admin still fully manages themselves (updateRole/deactivate
    // already have their own separate, unconditional self-checks that run
    // before this is ever reached, so this only matters for the other
    // actions: profile/group/team/password/2FA/reactivate).
    if (target?.id === actor.sub) {
      return;
    }
    const actorRow = await this.usersRepository.findById(actor.sub);
    if (!actorRow?.cannotManageAdmins) {
      return;
    }
    if (target?.role === UserRole.ADMIN || newRole === UserRole.ADMIN) {
      throw new ForbiddenException('Ограниченный администратор не может управлять учётными записями администраторов');
    }
  }

  findByEmail(email: string, options: { withDeleted?: boolean } = {}): Promise<UserEntity | null> {
    return this.usersRepository.findByEmail(email, options);
  }

  findById(id: string, options: { withDeleted?: boolean } = {}): Promise<UserEntity | null> {
    return this.usersRepository.findById(id, options);
  }

  create(data: {
    email: string;
    passwordHash: string | null;
    fullName: string;
    role: UserRole;
    approvedAt: Date | null;
    locale?: Locale;
    isVip?: boolean;
  }): Promise<UserEntity> {
    return this.usersRepository.create(data);
  }

  setRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    return this.usersRepository.setRefreshTokenHash(id, refreshTokenHash);
  }

  // Shared by updateRole/setAdminRestriction/assignPermissionGroup — a
  // sensitive-but-not-deactivating change to this account (unlike
  // deactivate(), the row stays findable, so JwtStrategy's existence-only
  // re-check never catches it). Nulling the refresh token hash blocks a
  // silent refresh once the current access token expires, forcing a real
  // re-login that mints fresh role/permission claims; the published event
  // (see AccountSecurityChangedEvent's own comment) additionally kicks any
  // live socket right away. Both best-effort, same reasoning as
  // deactivate()'s own publish: the DB write already committed by the time
  // this runs, so a Redis/socket hiccup here must not turn a successful
  // change into a 500.
  private async forceReauth(id: string): Promise<void> {
    await this.usersRepository.setRefreshTokenHash(id, null);
    try {
      await this.userEventsPublisher.publish({ type: 'account_security_changed', userId: id });
    } catch (err) {
      this.logger.warn(`Failed to publish account_security_changed for user ${id}: ${err}`);
    }
  }

  // Just-In-Time provisioning for a successful LDAP bind / OIDC callback —
  // called from AuthService.login()/oidc-auth.controller.ts, never from a
  // human-facing "create user" flow. Three outcomes:
  //  1. externalId already known (repeat login) — return that account.
  //  2. No externalId match, but the email already belongs to a local
  //     account (e.g. an admin-created operator signing in via SSO for the
  //     first time) — LINK it rather than throwing a duplicate-email
  //     conflict: set authProvider/externalId and null out the local
  //     password (per product decision, the account becomes directory-only
  //     going forward, not a dual-mode fallback).
  //  3. Neither — brand-new account, mirrors createByAdmin's
  //     no-approval-needed behavior (approvedAt set immediately), since
  //     there's no human in this flow to click "approve".
  async provisionFromDirectory(
    identity: AuthenticatedIdentity,
    provider: AuthProvider,
    defaultRole: UserRole,
  ): Promise<UserEntity> {
    const existing = await this.usersRepository.findByAuthProviderAndExternalId(provider, identity.externalId);
    if (existing) {
      return existing;
    }

    const byEmail = await this.usersRepository.findByEmail(identity.email, { withDeleted: true });
    if (byEmail) {
      await this.usersRepository.linkToDirectory(byEmail.id, provider, identity.externalId);
      return { ...byEmail, authProvider: provider, externalId: identity.externalId, passwordHash: null };
    }

    return this.usersRepository.create({
      email: identity.email,
      passwordHash: null,
      fullName: identity.fullName,
      role: defaultRole,
      approvedAt: new Date(),
      authProvider: provider,
      externalId: identity.externalId,
    });
  }

  rotateRefreshTokenHash(id: string, previousHash: string, newHash: string): Promise<boolean> {
    return this.usersRepository.rotateRefreshTokenHash(id, previousHash, newHash);
  }

  async getPublicProfile(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUserWithGroup(user);
  }

  // Admin-only path: unlike self-service register (always CLIENT), this
  // creates a user with whatever role the admin picks — the only way to
  // get an operator/admin account onto the system without touching SQL.
  async createByAdmin(dto: CreateUserDto, actor: JwtPayload): Promise<PublicUser> {
    await this.assertAdminActionAllowed(actor, null, dto.role);
    // withDeleted: email has a plain global unique index, not partial on
    // deleted_at IS NULL (see the InitSchema migration) — a deactivated
    // (soft-deleted) user still holds their email at the DB level. Without
    // this, the check above missed them (findByEmail's default excludes
    // soft-deleted rows), passed the friendly guard, and the INSERT below
    // then hit a raw Postgres unique-violation — a confusing 500 for a
    // realistic flow (replacing an employee/contact and reusing their
    // email) instead of a clear "already exists" message.
    const existing = await this.usersRepository.findByEmail(dto.email, { withDeleted: true });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      // An admin creating the account has already vetted it — never enters
      // the self-registration approval queue.
      approvedAt: new Date(),
      cannotManageAdmins: dto.role === UserRole.ADMIN ? (dto.cannotManageAdmins ?? false) : false,
      isVip: dto.role === UserRole.CLIENT ? (dto.isVip ?? false) : false,
    });
    return toPublicUser(user);
  }

  async updateRole(id: string, role: UserRole, actor: JwtPayload): Promise<PublicUser> {
    // An admin changing their OWN role through this endpoint could lock
    // themselves out with no other admin left to reverse it (raw SQL was
    // the only fallback before this endpoint existed). Force that one edge
    // case through a different admin's account instead.
    if (id === actor.sub) {
      throw new BadRequestException('Cannot change your own role');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user, role);

    await this.usersRepository.updateRole(id, role);
    // Team membership only makes sense for staff (see TeamsService.
    // assignUserTeam's own role guard) — demoting to CLIENT must clear it,
    // or the account keeps a stale team assignment indefinitely (nothing
    // else ever touches this row again once it's no longer staff).
    // Between OPERATOR and ADMIN, membership stays valid either way.
    if (role !== UserRole.OPERATOR && role !== UserRole.ADMIN) {
      await this.teamsService.assignUserTeam(id, null);
    }
    await this.forceReauth(id);
    return this.toPublicUserWithGroup({ ...user, role });
  }

  // New "restricted admin" toggle — dedicated endpoint (mirrors updateRole/
  // assignPermissionGroup above). Deliberately routed through the same
  // assertAdminActionAllowed(actor, target) check: since this flag is only
  // ever meaningful on an ADMIN-role target, a restricted admin can never
  // touch it on anyone (the target is always an admin), so only an
  // unrestricted admin can grant or revoke the restriction.
  async setAdminRestriction(id: string, cannotManageAdmins: boolean, actor: JwtPayload): Promise<PublicUser> {
    // Deliberately checked BEFORE (and separately from) assertAdminActionAllowed
    // below — that helper exempts self-targeting so a restricted admin can
    // still edit their own profile/password/2FA, but THIS action is a
    // privilege-escalation vector, not a normal self-edit: exempting self
    // here would let a restricted admin simply clear their own flag and
    // become a full admin. No one — restricted or not — sets their own
    // restriction status; it always has to come from a different admin.
    if (id === actor.sub) {
      throw new BadRequestException('Cannot change your own admin-restriction status');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);

    await this.usersRepository.updateAdminRestriction(id, cannotManageAdmins);
    await this.forceReauth(id);
    return this.toPublicUserWithGroup({ ...user, cannotManageAdmins });
  }

  // «VIP-клиент» toggle — mirrors setAdminRestriction above but much
  // simpler: unlike the admin-restriction flag, this carries no permission
  // hierarchy to protect (a client has no admin powers to escalate), so
  // there's no self-check and no assertAdminActionAllowed call — just a
  // sanity guard that it's only ever set on an actual client account.
  async setVip(id: string, isVip: boolean): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException('VIP status only applies to client accounts');
    }

    await this.usersRepository.setVip(id, isVip);
    return this.toPublicUserWithGroup({ ...user, isVip });
  }

  // Dedicated endpoint (mirrors updateRole above) rather than folded into
  // updateProfile — assigning a group is a categorization action, not a
  // profile-field edit. `permissionGroupId: null` clears the group.
  async assignPermissionGroup(
    id: string,
    permissionGroupId: string | null,
    actor: JwtPayload,
    currentPassword?: string,
    totpCode?: string,
  ): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);
    // Unlike the profile/team edits assertAdminActionAllowed's self-exemption
    // was written for, this field carries real security policy
    // (requireTwoFactor/ipWhitelist/restrictToDepartments) — a stolen access
    // token alone must not be enough to silently strip your OWN account's
    // policy. Same re-auth gate as resetTwoFactorByAdmin/resetPasswordByAdmin
    // above; assigning someone ELSE's group is unaffected.
    if (id === actor.sub) {
      await this.assertSelfReauth(user, currentPassword, totpCode);
    }
    if (permissionGroupId) {
      const groups = await this.permissionGroupsRepository.findFlagsByGroupIds([permissionGroupId]);
      if (!groups.has(permissionGroupId)) {
        throw new BadRequestException('Permission group not found');
      }
    }
    await this.usersRepository.updatePermissionGroup(id, permissionGroupId);
    await this.forceReauth(id);
    return this.toPublicUserWithGroup({ ...user, permissionGroupId });
  }

  // Dedicated endpoint (mirrors assignPermissionGroup above) — the «Отдел»
  // dropdown on EditUserModal is single-select, so this replaces ALL of the
  // user's team memberships with exactly this one (or none, if null). See
  // TeamsRepository.setUserTeam.
  async assignTeam(id: string, teamId: string | null, actor: JwtPayload): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);
    await this.teamsService.assignUserTeam(id, teamId);
    // Department/team membership feeds restrictToDepartments scoping in the
    // JWT (see PermissionGroupsService's own forceReauthForMembers for the
    // same reasoning) — without this, a narrowing team change stayed live in
    // an already-issued access token for its full remaining TTL, unlike
    // every sibling mutation here (updateRole/assignPermissionGroup/
    // setAdminRestriction) that already forces reauth for exactly this
    // reason.
    await this.forceReauth(id);
    return this.toPublicUserWithGroup(user);
  }

  async updateProfile(id: string, dto: UpdateUserProfileDto, actor: JwtPayload): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);
    // Only re-validate a value that's actually changing. EditUserModal always
    // submits every field, including a company/city that predates the catalog
    // (or whose matching entry was since renamed/removed) — the select keeps
    // that stale value visible rather than silently discarding it. Without
    // this guard, saving an unrelated field (phone, role, …) on such a user
    // would be rejected by the catalog check even though nothing about
    // company/city was touched.
    await this.assertKnownCompanyAndCity(
      dto.company !== undefined && dto.company !== user.company ? dto.company : undefined,
      dto.city !== undefined && dto.city !== user.city ? dto.city : undefined,
    );

    // Only fields actually present in the request are touched — an omitted
    // key leaves the existing value alone, an explicit empty string clears
    // it to null. The edit modal always sends every field, so in practice
    // this just means "clear" works the way an admin would expect.
    const data: UpdateUserProfileData = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.computerName !== undefined) data.computerName = dto.computerName || null;
    if (dto.position !== undefined) data.position = dto.position || null;
    if (dto.department !== undefined) data.department = dto.department || null;
    if (dto.company !== undefined) data.company = dto.company || null;
    if (dto.city !== undefined) data.city = dto.city || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;

    await this.usersRepository.updateProfile(id, data);
    return this.toPublicUserWithGroup({ ...user, ...data });
  }

  // Self-service counterpart to updateProfile — any authenticated user
  // (client or staff), editing only their own limited whitelist of fields.
  // Builds its own `data` (rather than delegating to updateProfile) because
  // `locale` isn't one of the admin-editable UpdateUserProfileDto fields —
  // keeping the two field lists separate means a change to one can't
  // accidentally leak into what the other accepts.
  async updateOwnProfile(actor: JwtPayload, dto: UpdateOwnProfileDto): Promise<PublicUser> {
    const user = await this.usersRepository.findById(actor.sub, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.computerName === '' && user.computerName) {
      throw new BadRequestException('Имя компьютера нельзя очистить, если оно уже указано');
    }
    if (dto.phone === '' && user.phone) {
      throw new BadRequestException('Телефон нельзя очистить, если он уже указан');
    }

    const data: UpdateUserProfileData = {};
    if (dto.computerName !== undefined) data.computerName = dto.computerName || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.locale !== undefined) data.locale = dto.locale;

    await this.usersRepository.updateProfile(actor.sub, data);
    return this.toPublicUserWithGroup({ ...user, ...data });
  }

  // Backs the mandatory client-onboarding form (client-portal shows a
  // non-dismissible modal until this has run once) — self-service, only
  // ever touches the caller's own row. Unlike updateOwnProfile above,
  // every field except computerName is required (enforced by
  // CompleteProfileDto, not here), and this is the one place that stamps
  // profileCompletedAt — nothing else in the app ever sets it.
  async completeProfile(actor: JwtPayload, dto: CompleteProfileDto): Promise<PublicUser> {
    const user = await this.usersRepository.findById(actor.sub);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertKnownCompanyAndCity(dto.company, dto.city);

    const data: UpdateUserProfileData = {
      position: dto.position,
      department: dto.department,
      company: dto.company,
      city: dto.city,
      phone: dto.phone,
      computerName: dto.computerName || null,
      profileCompletedAt: new Date(),
    };

    await this.usersRepository.updateProfile(actor.sub, data);
    return this.toPublicUserWithGroup({ ...user, ...data });
  }

  // Soft-delete, not a real DELETE — every ticket/comment/activity this
  // person ever authored keeps its FK exactly as it was; only login and
  // the assignee/mention pickers stop seeing them (see UsersRepository).
  async deactivate(id: string, actor: JwtPayload): Promise<PublicUser> {
    if (id === actor.sub) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);

    await this.usersRepository.deactivate(id);
    // Live-kicks any open tab this person still has (see ChatGateway.
    // forceDisconnectUser) — a deactivated account's already-issued access
    // token would otherwise keep working (both over REST, until the JwtStrategy
    // DB check catches it on their next request, and over their existing
    // socket, which never re-checks the token after handshake) for as long
    // as the tab stays open. Best-effort: the soft-delete above already
    // committed, so a Redis hiccup here must not turn a successful
    // deactivation into a 500 (which would also be confusing to retry — the
    // user is already gone from a plain findById, so a second attempt would
    // 404 instead of confirming what already happened). The REST-side
    // JwtStrategy check is the fallback that still closes this account's
    // access even if this specific push never lands.
    try {
      await this.userEventsPublisher.publish({ type: 'account_deactivated', userId: id });
    } catch (err) {
      this.logger.warn(`Failed to publish account_deactivated for user ${id}: ${err}`);
    }
    return this.toPublicUserWithGroup({ ...user, deletedAt: new Date() });
  }

  async reactivate(id: string, actor: JwtPayload): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);

    await this.usersRepository.reactivate(id);
    return this.toPublicUserWithGroup({ ...user, deletedAt: undefined });
  }

  // Real DELETE, not deactivate — erases the account AND every ticket it
  // actually owns (created_by), cascading away that ticket's comments/
  // attachments/activities/tags/watchers/CSAT with it (see TicketsRepository
  // .hardDelete's own comment for the full FK-cascade list). Deliberately
  // NOT offered for a full admin (only a "restricted" one, see the
  // cannotManageAdmins check below) — a full admin's audit-log footprint is
  // meant to be permanent, and deactivate is the only lever for that role.
  //
  // Everything this person touched on somebody ELSE's ticket (assigned to
  // them, or authored by them as staff) is NOT theirs to take down with
  // them: tickets.assigned_to is freed back to the unassigned pool, and
  // comments/knowledge_articles/ticket_activities/settings_audit_log rows
  // are re-attributed to the seeded SYSTEM_USER_ID ("Автоответчик") instead
  // of being deleted or left dangling — those 4 columns are a live, blocking
  // FK to users.id (ON DELETE NO ACTION, see InitSchema/AddTicketActivities/
  // AddSettingsAuditLog migrations), so the DELETE below would otherwise
  // fail outright the moment this person has done anything outside their
  // own tickets.
  async hardDelete(id: string, actor: JwtPayload): Promise<void> {
    if (id === actor.sub) {
      throw new BadRequestException('Cannot delete your own account');
    }
    if (id === SYSTEM_USER_ID) {
      throw new BadRequestException('Cannot delete the system account');
    }

    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);
    if (user.role === UserRole.ADMIN && !user.cannotManageAdmins) {
      throw new ForbiddenException('Полноправного администратора нельзя удалить — только деактивировать');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TicketEntity, { createdBy: id });

      await manager
        .createQueryBuilder()
        .update(TicketEntity)
        .set({ assignedTo: null })
        .where('assigned_to = :id', { id })
        .execute();
      await manager.update(CommentEntity, { authorId: id }, { authorId: SYSTEM_USER_ID });
      await manager.update(KnowledgeArticleEntity, { authorId: id }, { authorId: SYSTEM_USER_ID });
      await manager.update(TicketActivityEntity, { actorId: id }, { actorId: SYSTEM_USER_ID });
      await manager.update(SettingsAuditLogEntity, { actorId: id }, { actorId: SYSTEM_USER_ID });

      await manager.delete(UserEntity, id);
    });

    // Same best-effort reasoning as deactivate() above — the hard delete
    // already committed, so a Redis hiccup here must not surface as an
    // error for an action that already fully succeeded.
    try {
      await this.userEventsPublisher.publish({ type: 'account_deleted', userId: id });
    } catch (err) {
      this.logger.warn(`Failed to publish account_deleted for user ${id}: ${err}`);
    }
  }

  // Feeds the bell/modal — self-registrations awaiting a decision.
  async listPending(): Promise<PublicUser[]> {
    const rows = await this.usersRepository.findPending();
    // Plain toPublicUser, not toPublicUsersWithGroups — a still-pending row
    // can never have a permission group or team (nothing has touched it
    // since AuthService.register created it), so those joins would be pure
    // overhead here.
    return rows.map((user) => toPublicUser(user));
  }

  async approve(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.approvedAt) {
      throw new BadRequestException('User is already approved');
    }
    // Conditioned on approved_at still being NULL at write time, not just at
    // the read above — closes the race where a concurrent reject() (or a
    // second approve()) already changed the row between the check and this
    // write. Without this, a losing request here would otherwise return a
    // fabricated "success" built from its own stale read.
    const approvedAt = new Date();
    const applied = await this.usersRepository.setApprovedAtIfPending(id, approvedAt);
    if (!applied) {
      throw new ConflictException('User was already approved or rejected by someone else');
    }
    return this.toPublicUserWithGroup({ ...user, approvedAt });
  }

  // Hard delete, not deactivate — a never-approved row was never usable
  // (AuthService.register issues no tokens for it), so there's nothing to
  // preserve or keep hidden: it just disappears, the same way it would if
  // the registration had never happened. See UsersRepository.hardDeleteIfPending.
  // That assumption breaks for an email-provisioned pending account (see
  // EmailUserResolverService.findOrCreateByEmail) — it can already have real
  // tickets/comments attached despite never completing approval, unlike a
  // self-registered row (blocked from doing anything by AuthService's
  // completeLogin check). Unlike UsersService.hardDelete, this path doesn't
  // reassign that data to SYSTEM_USER_ID — a reject should surface the
  // conflict to the admin rather than silently absorbing content into a
  // rejected account's history.
  async reject(id: string): Promise<void> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.approvedAt) {
      throw new BadRequestException('Cannot reject an already-approved user');
    }
    let applied: boolean;
    try {
      // Same race-closing condition as approve() above.
      applied = await this.usersRepository.hardDeleteIfPending(id);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
        throw new ConflictException('Cannot reject — this account already has tickets or comments; deactivate it instead');
      }
      throw error;
    }
    if (!applied) {
      throw new ConflictException('User was already approved or rejected by someone else');
    }
  }

  // Called only after AuthService has verified a fresh TOTP code against the
  // pending secret — this method itself does no verification, it just commits.
  async enableTwoFactor(id: string, totpSecretEncrypted: string): Promise<void> {
    await this.usersRepository.setTwoFactor(id, { totpSecretEncrypted, twoFactorEnabled: true });
  }

  async disableTwoFactor(id: string): Promise<void> {
    await this.usersRepository.setTwoFactor(id, { totpSecretEncrypted: null, twoFactorEnabled: false });
  }

  // Gates the SELF-targeting case of resetTwoFactorByAdmin/
  // resetPasswordByAdmin below — a valid session token alone must not be
  // enough to durably take over an admin's OWN account (set a new
  // password, strip their own 2FA), the way it legitimately can for
  // recovering a locked-out colleague's. Same bcrypt-then-TOTP order as
  // AuthService.disableTwoFactor, which this mirrors — proving you can
  // still produce a live code IS how you're allowed to turn 2FA off, not a
  // bypassable side channel.
  private async assertSelfReauth(
    user: UserEntity,
    currentPassword: string | undefined,
    totpCode: string | undefined,
  ): Promise<void> {
    if (user.passwordHash) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Неверный текущий пароль');
      }
    } else if (!user.twoFactorEnabled) {
      // Directory-provisioned/linked account (authProvider !== LOCAL) with
      // no local password and no 2FA — there's no factor this self-service
      // check can verify. Only a different admin acting on this account can
      // proceed from here (assertAdminActionAllowed's non-self branch).
      throw new UnauthorizedException('Самостоятельное подтверждение недоступно для этой учётной записи');
    }
    if (user.twoFactorEnabled) {
      const secret = user.totpSecretEncrypted ? this.totpEncryptionService.decrypt(user.totpSecretEncrypted) : null;
      if (!secret || !totpCode || !this.totpService.verifyCode(secret, totpCode)) {
        throw new UnauthorizedException('Неверный код подтверждения');
      }
    }
  }

  // Admin-only recovery path — there are no backup codes (decided
  // deliberately, see design spec), so a lost authenticator device means an
  // admin clears the secret from «Пользователи» and the owner sets it up
  // again at their next login. Resetting your OWN 2FA this way additionally
  // requires proving you still have it (assertSelfReauth) — otherwise a
  // stolen session token alone could strip an admin's own 2FA protection.
  async resetTwoFactorByAdmin(
    id: string,
    actor: JwtPayload,
    currentPassword?: string,
    totpCode?: string,
  ): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertAdminActionAllowed(actor, user);
    if (id === actor.sub) {
      await this.assertSelfReauth(user, currentPassword, totpCode);
    }
    await this.usersRepository.setTwoFactor(id, { totpSecretEncrypted: null, twoFactorEnabled: false });
    return this.toPublicUserWithGroup({ ...user, totpSecretEncrypted: null, twoFactorEnabled: false });
  }

  // Admin-only — the "someone else forgot their password / lost their
  // device" recovery path (see changeOwnPassword below for the genuine
  // self-service one). Also revokes their current refresh token: a
  // password reset must end every existing session (e.g. the account was
  // compromised), not just gate future logins. Resetting your OWN password
  // this way additionally requires assertSelfReauth — otherwise a stolen
  // session token alone could plant a durable new password with no
  // re-authentication at all. In practice every frontend now sends its own
  // "change my password" traffic through changeOwnPassword instead — this
  // self-targeting branch stays as defense-in-depth for a direct API call.
  async resetPasswordByAdmin(
    id: string,
    password: string,
    actor: JwtPayload,
    currentPassword?: string,
    totpCode?: string,
  ): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertLocalAuthProvider(user);
    await this.assertAdminActionAllowed(actor, user);
    if (id === actor.sub) {
      await this.assertSelfReauth(user, currentPassword, totpCode);
    }
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    await this.usersRepository.updatePasswordHash(id, passwordHash);
    // forceReauth, not a bare setRefreshTokenHash: a password reset must
    // end every session RIGHT AWAY (the whole point when the account was
    // compromised), including one already live over WebSocket — the same
    // gap updateRole/setAdminRestriction/assignPermissionGroup close by
    // using this helper instead of just nulling the token.
    await this.forceReauth(id);
    return this.toPublicUserWithGroup({ ...user, passwordHash });
  }

  // The genuine self-service "change my password" flow — any authenticated
  // role (client/operator/admin), always self-targeting by construction
  // (no id param, mirrors updateOwnProfile/completeProfile's shape rather
  // than resetPasswordByAdmin's admin+id one). Reuses the same
  // assertSelfReauth gate and session-revocation behavior as the admin
  // path above; the only real difference is there's no assertAdminActionAllowed
  // to run, since there's no "acting on someone else" case here at all.
  async changeOwnPassword(
    actor: JwtPayload,
    currentPassword: string,
    newPassword: string,
    totpCode?: string,
  ): Promise<void> {
    const user = await this.usersRepository.findById(actor.sub, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertLocalAuthProvider(user);
    await this.assertSelfReauth(user, currentPassword, totpCode);
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.usersRepository.updatePasswordHash(actor.sub, passwordHash);
    // Same reasoning as resetPasswordByAdmin above — forceReauth also kicks
    // any live socket immediately, not just future refreshes.
    await this.forceReauth(actor.sub);
  }

  // A directory-provisioned/linked account (authProvider !== LOCAL) has no
  // password VeloxDesk checks — setting one here would silently create a
  // hash nothing ever validates. The org's directory is the source of
  // truth for that account's credential; there's no "convert back to
  // local" flow, so this is a hard stop, not a warning.
  private assertLocalAuthProvider(user: UserEntity): void {
    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new BadRequestException('Эта учётная запись управляется через AD/SSO — пароль задаётся не в VeloxDesk');
    }
  }

  async getStatusHistory(id: string): Promise<PublicStatusHistoryEntry[]> {
    const user = await this.usersRepository.findById(id, { withDeleted: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.employeeStatusesService.getHistoryForUser(id);
  }

  async listPublicProfiles(limit = DEFAULT_PAGE_SIZE, cursor?: string, search?: string): Promise<PublicUserPage> {
    // Search mode (see ListUsersQueryDto's own comment) sorts by fullName
    // instead of createdAt, so a cursor from one mode is meaningless in the
    // other — which mode `cursor` decodes as follows `search` on each call.
    // Both support real Prev/Next paging: the async-search picker only ever
    // asks for the first page, but the paginated admin Users table
    // (UsersPage) pages through search results too.
    const after = !search && cursor ? this.parseCursor(cursor) : undefined;
    const searchAfter = search && cursor ? this.parseNameCursor(cursor) : undefined;
    const rows = await this.usersRepository.findPage(limit, after, search, searchAfter);

    // Trimmed to `limit` regardless of mode — findPage always fetches
    // `limit + 1` so this can tell whether more exist.
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = page.at(-1);
    const nextCursor =
      hasMore && lastRow
        ? search
          ? encodeNameCursor({ fullName: lastRow.fullName, id: lastRow.id })
          : encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
        : null;

    return {
      items: await this.toPublicUsersWithGroups(page),
      nextCursor,
    };
  }

  private parseCursor(cursor: string) {
    try {
      return decodeCursor(cursor);
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }

  private parseNameCursor(cursor: string) {
    try {
      return decodeNameCursor(cursor);
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }
}
