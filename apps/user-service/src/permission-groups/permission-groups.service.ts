import { JwtPayload, SettingsAuditLogService } from '@veloxdesk/common';
import { TeamEntity } from '@veloxdesk/database';
import { SettingsAuditEventType, SettingsAuditModule } from '@veloxdesk/types';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserEventsPublisherService } from '../user-events/user-events-publisher.service.js';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto.js';
import { UpdatePermissionGroupDto } from './dto/update-permission-group.dto.js';
import { PermissionGroupsRepository } from './permission-groups.repository.js';
import { PublicPermissionGroup, toPublicPermissionGroup } from './permission-group.public.js';

@Injectable()
export class PermissionGroupsService {
  private readonly logger = new Logger(PermissionGroupsService.name);

  constructor(
    private readonly permissionGroupsRepository: PermissionGroupsRepository,
    private readonly settingsAuditLog: SettingsAuditLogService,
    @InjectRepository(TeamEntity)
    private readonly teamsRepository: Repository<TeamEntity>,
    private readonly userEventsPublisher: UserEventsPublisherService,
  ) {}

  // Mirrors UsersService.forceReauth, applied to a whole group's members at
  // once — a group-level policy change (restrictToDepartments/
  // restrictToOwnTickets/requireTwoFactor/ipWhitelist, or the group being
  // deleted outright) changes what EVERY member is allowed to do, but their
  // already-issued access tokens keep their OLD claims for the rest of
  // that token's TTL regardless (JwtStrategy only re-checks that the row
  // still exists — see that file's own comment). Nulling refresh tokens
  // blocks a silent future refresh; the published events additionally kick
  // any live socket right away. Both best-effort. `memberIds` is always
  // caller-supplied (never re-derived from groupId here) so remove() can
  // pass ids captured BEFORE the group row (and its ON DELETE SET NULL FK)
  // is gone.
  private async forceReauthForMembers(memberIds: string[]): Promise<void> {
    if (memberIds.length === 0) return;
    await this.permissionGroupsRepository.clearRefreshTokensForUserIds(memberIds);
    await Promise.all(
      memberIds.map((userId) =>
        this.userEventsPublisher
          .publish({ type: 'account_security_changed', userId })
          .catch((err) => this.logger.warn(`Failed to publish account_security_changed for user ${userId}: ${err}`)),
      ),
    );
  }

  async create(dto: CreatePermissionGroupDto, actor: JwtPayload): Promise<PublicPermissionGroup> {
    const departmentIds = await this.validateDepartmentIds(dto.departmentIds);
    const group = await this.permissionGroupsRepository.create(dto);
    if (departmentIds.length > 0) {
      await this.permissionGroupsRepository.setDepartments(group.id, departmentIds);
    }
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.PERMISSION_GROUP,
      eventType: SettingsAuditEventType.CREATED,
      entityId: group.id,
      entityLabel: group.name,
      changes: { ...dto },
    });
    return toPublicPermissionGroup(group, departmentIds, 0);
  }

  async list(): Promise<PublicPermissionGroup[]> {
    const groups = await this.permissionGroupsRepository.findAll();
    const groupIds = groups.map((g) => g.id);
    const [departmentMap, memberCountMap] = await Promise.all([
      this.permissionGroupsRepository.findDepartmentIdsByGroupIds(groupIds),
      this.permissionGroupsRepository.countMembersByGroupIds(groupIds),
    ]);
    return groups.map((group) =>
      toPublicPermissionGroup(group, departmentMap.get(group.id) ?? [], memberCountMap.get(group.id) ?? 0),
    );
  }

  async update(id: string, dto: UpdatePermissionGroupDto, actor: JwtPayload): Promise<PublicPermissionGroup> {
    await this.getGroupOrThrow(id);
    const memberIds = await this.permissionGroupsRepository.findMemberIds(id);
    await this.assertGroupMutationAllowed(id, memberIds, actor);

    const patch: Parameters<PermissionGroupsRepository['update']>[1] = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.restrictToDepartments !== undefined) patch.restrictToDepartments = dto.restrictToDepartments;
    if (dto.restrictToOwnTickets !== undefined) patch.restrictToOwnTickets = dto.restrictToOwnTickets;
    if (dto.cannotBeAssignee !== undefined) patch.cannotBeAssignee = dto.cannotBeAssignee;
    if (dto.requireTwoFactor !== undefined) patch.requireTwoFactor = dto.requireTwoFactor;
    if (dto.ipWhitelist !== undefined) patch.ipWhitelist = dto.ipWhitelist;
    if (Object.keys(patch).length > 0) {
      await this.permissionGroupsRepository.update(id, patch);
    }

    if (dto.departmentIds !== undefined) {
      const departmentIds = await this.validateDepartmentIds(dto.departmentIds);
      await this.permissionGroupsRepository.setDepartments(id, departmentIds);
    }

    // Every field this group can change (departmentIds included — it's its
    // own JWT claim, set via setDepartments above, not part of `patch`) is
    // baked into every member's JwtPayload at their next login/refresh —
    // see AuthService.issueTokens. Simplest safe trigger: force reauth
    // whenever this update actually wrote something, rather than trying to
    // enumerate exactly which fields are JWT-relevant and risk missing one.
    if (Object.keys(patch).length > 0 || dto.departmentIds !== undefined) {
      // memberIds was captured above, before this update — update() never
      // changes WHO belongs to the group (that's UsersService.
      // assignPermissionGroup), only the group's own fields, so re-fetching
      // here would just be the same list again at the cost of another query.
      await this.forceReauthForMembers(memberIds);
    }

    const updated = await this.getGroupOrThrow(id);
    const [departmentIds, memberCount] = await Promise.all([
      this.permissionGroupsRepository.findDepartmentIds(id),
      this.permissionGroupsRepository.countMembers(id),
    ]);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.PERMISSION_GROUP,
      eventType: SettingsAuditEventType.UPDATED,
      entityId: updated.id,
      entityLabel: updated.name,
      changes: { ...dto },
    });
    return toPublicPermissionGroup(updated, departmentIds, memberCount);
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const group = await this.getGroupOrThrow(id);
    // Captured BEFORE delete() — the FK's ON DELETE SET NULL means every
    // member's permission_group_id is already gone by the time delete()
    // returns, so this is the only point where findMemberIds(id) can still
    // see them.
    const memberIds = await this.permissionGroupsRepository.findMemberIds(id);
    await this.assertGroupMutationAllowed(id, memberIds, actor);
    // Members' users.permission_group_id is FK ON DELETE SET NULL (see
    // migration) — deleting a group just drops its members back to
    // unrestricted, same as if they'd never had a group.
    await this.permissionGroupsRepository.delete(id);
    await this.forceReauthForMembers(memberIds);
    await this.settingsAuditLog.log({
      actorId: actor.sub,
      module: SettingsAuditModule.PERMISSION_GROUP,
      eventType: SettingsAuditEventType.DELETED,
      entityId: group.id,
      entityLabel: group.name,
    });
  }

  // Editing or deleting a group is a privilege-escalation vector: its
  // policy fields (requireTwoFactor/restrictToDepartments/restrictToOwnTickets/
  // ipWhitelist) apply to every member at once, and deleting the group
  // drops all of them back to unrestricted via the FK's ON DELETE SET NULL.
  // Two checks, mirroring UsersService's own established rules for
  // similarly-shaped actions:
  //  1. Self-targeting is forbidden outright, not just re-auth-gated (same
  //     rule as setAdminRestriction — a stolen session AND a correct
  //     password are still not enough reason for someone to unilaterally
  //     loosen their own security policy; it has to come from a different
  //     admin). UsersService.assignPermissionGroup's assertSelfReauth only
  //     covers moving a user in/out of a group — it was never reachable
  //     from this side door, which rewrites the group's own fields instead.
  //  2. The assertAdminActionAllowed hierarchy check: a restricted admin
  //     (cannotManageAdmins) can't touch a group that counts an ADMIN among
  //     its current members, since that's exactly "managing an admin
  //     account" one level removed.
  private async assertGroupMutationAllowed(groupId: string, memberIds: string[], actor: JwtPayload): Promise<void> {
    if (memberIds.includes(actor.sub)) {
      throw new ForbiddenException(
        'Нельзя изменить или удалить группу прав, в которую входите вы сами — это должен сделать другой администратор',
      );
    }
    if (await this.permissionGroupsRepository.hasAdminMember(groupId)) {
      if (await this.permissionGroupsRepository.isRestrictedAdmin(actor.sub)) {
        throw new ForbiddenException('Ограниченный администратор не может управлять учётными записями администраторов');
      }
    }
  }

  private async getGroupOrThrow(id: string) {
    const group = await this.permissionGroupsRepository.findById(id);
    if (!group) {
      throw new NotFoundException('Permission group not found');
    }
    return group;
  }

  private async validateDepartmentIds(departmentIds: string[] | undefined): Promise<string[]> {
    if (!departmentIds || departmentIds.length === 0) return [];
    const unique = [...new Set(departmentIds)];
    const teams = await this.teamsRepository.find({ where: { id: In(unique) } });
    if (teams.length !== unique.length) {
      throw new BadRequestException('Один или несколько выбранных отделов не найдены');
    }
    return unique;
  }
}
