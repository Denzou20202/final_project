import { UserEntity } from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { PublicTeam, toPublicTeam } from './team.public.js';
import { TeamsRepository } from './teams.repository.js';

@Injectable()
export class TeamsService {
  constructor(
    private readonly teamsRepository: TeamsRepository,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(dto: CreateTeamDto): Promise<PublicTeam> {
    const memberIds = await this.validateMemberIds(dto.memberIds);
    const team = await this.teamsRepository.create({
      name: dto.name,
      nameUk: dto.nameUk ?? null,
      nameEn: dto.nameEn ?? null,
    });
    if (memberIds.length > 0) {
      await this.teamsRepository.setMembers(team.id, memberIds);
    }
    return toPublicTeam(team, memberIds);
  }

  async list(): Promise<PublicTeam[]> {
    const teams = await this.teamsRepository.findAll();
    const memberMap = await this.teamsRepository.findMemberIdsByTeamIds(teams.map((t) => t.id));
    return teams.map((team) => toPublicTeam(team, memberMap.get(team.id) ?? []));
  }

  async update(id: string, dto: UpdateTeamDto): Promise<PublicTeam> {
    await this.getTeamOrThrow(id);

    if (dto.name !== undefined || dto.nameUk !== undefined || dto.nameEn !== undefined) {
      await this.teamsRepository.updateName(id, dto.name, dto.nameUk, dto.nameEn);
    }
    if (dto.memberIds !== undefined) {
      const memberIds = await this.validateMemberIds(dto.memberIds);
      await this.teamsRepository.setMembers(id, memberIds);
    }

    const updated = await this.getTeamOrThrow(id);
    const memberIds = await this.teamsRepository.findMemberIds(id);
    return toPublicTeam(updated, memberIds);
  }

  // Batch version for list views (users.service.ts's toPublicUsersWithGroups)
  // — one query for a whole page instead of one per row.
  async getTeamIdsForUsers(userIds: string[]): Promise<Map<string, string | null>> {
    const membershipMap = await this.teamsRepository.findTeamIdsByUserIds(userIds);
    const result = new Map<string, string | null>();
    for (const userId of userIds) {
      result.set(userId, membershipMap.get(userId)?.[0] ?? null);
    }
    return result;
  }

  async getTeamIdForUser(userId: string): Promise<string | null> {
    const map = await this.getTeamIdsForUsers([userId]);
    return map.get(userId) ?? null;
  }

  // Dedicated single-team assignment (mirrors PermissionGroupsService's
  // shape) — called from the «Отдел» dropdown on EditUserModal, not from
  // this module's own controller. teamId: null clears the user out of every
  // team they're currently in.
  // Clearing (teamId: null) needs no role check — always safe. Assigning
  // TO a team does: unlike create()/update() above, this had no equivalent
  // of validateMemberIds() at all, so a direct API call (PATCH
  // /users/:id/team) could put a CLIENT into a team — an invariant this
  // table is otherwise only ever written to through the member-list path,
  // which does enforce it.
  async assignUserTeam(userId: string, teamId: string | null): Promise<void> {
    if (teamId) {
      await this.getTeamOrThrow(teamId);
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user || ![UserRole.OPERATOR, UserRole.ADMIN].includes(user.role)) {
        throw new BadRequestException('Только сотрудники (операторы/администраторы) могут быть добавлены в отдел');
      }
    }
    await this.teamsRepository.setUserTeam(userId, teamId);
  }

  async remove(id: string): Promise<void> {
    const team = await this.getTeamOrThrow(id);
    const ticketCount = await this.teamsRepository.countTicketsForTeam(id);
    if (ticketCount > 0) {
      throw new BadRequestException(
        `Нельзя удалить отдел «${team.name}» — на него ссылаются тикеты (${ticketCount}). Сначала перенесите их в другой отдел.`,
      );
    }
    await this.teamsRepository.delete(id);
  }

  private async getTeamOrThrow(id: string) {
    const team = await this.teamsRepository.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  // Membership is staff-only (operator/admin) — a client id, a typo'd id,
  // or a since-deactivated operator (soft-delete excludes them from find()
  // automatically) all fail the same way: the count of resolved users won't
  // match what was asked for.
  private async validateMemberIds(memberIds: string[] | undefined): Promise<string[]> {
    if (!memberIds || memberIds.length === 0) return [];
    const unique = [...new Set(memberIds)];
    const users = await this.usersRepository.find({
      where: { id: In(unique), role: In([UserRole.OPERATOR, UserRole.ADMIN]) },
    });
    if (users.length !== unique.length) {
      throw new BadRequestException('Один или несколько выбранных пользователей недоступны для назначения в отдел');
    }
    return unique;
  }
}
