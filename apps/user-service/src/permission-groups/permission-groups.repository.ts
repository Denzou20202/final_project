import { PermissionGroupDepartmentEntity, PermissionGroupEntity, UserEntity } from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto.js';

@Injectable()
export class PermissionGroupsRepository {
  constructor(
    @InjectRepository(PermissionGroupEntity)
    private readonly repository: Repository<PermissionGroupEntity>,
    @InjectRepository(PermissionGroupDepartmentEntity)
    private readonly departmentsRepository: Repository<PermissionGroupDepartmentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  create(dto: Pick<CreatePermissionGroupDto, 'name' | 'restrictToDepartments' | 'restrictToOwnTickets' | 'cannotBeAssignee' | 'requireTwoFactor' | 'ipWhitelist'>): Promise<PermissionGroupEntity> {
    return this.repository.save(
      this.repository.create({
        name: dto.name,
        restrictToDepartments: dto.restrictToDepartments ?? false,
        restrictToOwnTickets: dto.restrictToOwnTickets ?? false,
        cannotBeAssignee: dto.cannotBeAssignee ?? false,
        requireTwoFactor: dto.requireTwoFactor ?? false,
        ipWhitelist: dto.ipWhitelist ?? [],
      }),
    );
  }

  findAll(): Promise<PermissionGroupEntity[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<PermissionGroupEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, patch: Partial<Omit<PermissionGroupEntity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.repository.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    // Members' users.permission_group_id is FK ON DELETE SET NULL — removing
    // a group never orphans or blocks on its former members.
    await this.repository.delete({ id });
  }

  findDepartmentIds(groupId: string): Promise<string[]> {
    return this.departmentsRepository
      .find({ where: { permissionGroupId: groupId } })
      .then((rows) => rows.map((row) => row.teamId));
  }

  async findDepartmentIdsByGroupIds(groupIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (groupIds.length === 0) return map;
    const rows = await this.departmentsRepository.find({ where: { permissionGroupId: In(groupIds) } });
    for (const row of rows) {
      const list = map.get(row.permissionGroupId);
      if (list) list.push(row.teamId);
      else map.set(row.permissionGroupId, [row.teamId]);
    }
    return map;
  }

  // Full replace, same semantics as TeamsRepository.setMembers.
  async setDepartments(groupId: string, teamIds: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(PermissionGroupDepartmentEntity, { permissionGroupId: groupId });
      if (teamIds.length > 0) {
        await manager.insert(
          PermissionGroupDepartmentEntity,
          teamIds.map((teamId) => ({ permissionGroupId: groupId, teamId })),
        );
      }
    });
  }

  async countMembers(groupId: string): Promise<number> {
    return this.usersRepository.count({ where: { permissionGroupId: groupId } });
  }

  findMemberIds(groupId: string): Promise<string[]> {
    return this.usersRepository
      .find({ where: { permissionGroupId: groupId }, select: ['id'] })
      .then((rows) => rows.map((row) => row.id));
  }

  // Used by PermissionGroupsService's self-escalation guard: editing/
  // deleting a group is a privilege-escalation vector when one of its own
  // members has role ADMIN — see that call site for why.
  async hasAdminMember(groupId: string): Promise<boolean> {
    const count = await this.usersRepository.count({ where: { permissionGroupId: groupId, role: UserRole.ADMIN } });
    return count > 0;
  }

  // Live DB read, not a JWT claim — same reasoning as UsersService.
  // assertAdminActionAllowed: toggling cannotManageAdmins on someone takes
  // effect immediately, not just after their next token refresh.
  async isRestrictedAdmin(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ['cannotManageAdmins'] });
    return user?.cannotManageAdmins ?? false;
  }

  // Bulk equivalent of UsersRepository.setRefreshTokenHash(id, null) — a
  // group-level policy change (restrictToDepartments/restrictToOwnTickets/
  // requireTwoFactor/ipWhitelist) affects every member at once, so this is
  // one UPDATE ... WHERE instead of looping a per-user call. Takes explicit
  // ids (captured by the caller BEFORE any group deletion) rather than a
  // groupId filter — PermissionGroupEntity's FK is ON DELETE SET NULL, so
  // filtering by permission_group_id after delete() would match nothing.
  async clearRefreshTokensForUserIds(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.usersRepository.update({ id: In(userIds) }, { refreshTokenHash: null });
  }

  async countMembersByGroupIds(groupIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (groupIds.length === 0) return map;
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.permission_group_id', 'groupId')
      .addSelect('COUNT(*)', 'count')
      .where('user.permission_group_id IN (:...groupIds)', { groupIds })
      .groupBy('user.permission_group_id')
      .getRawMany<{ groupId: string; count: string }>();
    for (const row of rows) {
      map.set(row.groupId, Number(row.count));
    }
    return map;
  }

  // Used wherever a user's group-derived flags need to be read without
  // pulling the whole PublicPermissionGroup shape (toPublicUser's
  // canBeAssignee, the login-time JWT snapshot, etc).
  async findFlagsByGroupIds(groupIds: string[]): Promise<Map<string, PermissionGroupEntity>> {
    const map = new Map<string, PermissionGroupEntity>();
    const unique = [...new Set(groupIds)];
    if (unique.length === 0) return map;
    const groups = await this.repository.find({ where: { id: In(unique) } });
    for (const group of groups) {
      map.set(group.id, group);
    }
    return map;
  }
}
