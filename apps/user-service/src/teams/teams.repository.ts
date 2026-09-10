import { TeamEntity, TeamMemberEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

@Injectable()
export class TeamsRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repository: Repository<TeamEntity>,
    @InjectRepository(TeamMemberEntity)
    private readonly membersRepository: Repository<TeamMemberEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  create(data: { name: string; nameUk?: string | null; nameEn?: string | null }): Promise<TeamEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<TeamEntity[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<TeamEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async updateName(id: string, name?: string, nameUk?: string, nameEn?: string): Promise<void> {
    const patch: Partial<Pick<TeamEntity, 'name' | 'nameUk' | 'nameEn'>> = {};
    if (name !== undefined) patch.name = name;
    if (nameUk !== undefined) patch.nameUk = nameUk;
    if (nameEn !== undefined) patch.nameEn = nameEn;
    if (Object.keys(patch).length === 0) return;
    await this.repository.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    // team_members rows cascade automatically (FK ON DELETE CASCADE);
    // tickets.team_id is ON DELETE NO ACTION on purpose — the service layer
    // checks countTicketsForTeam() first so this never actually hits that
    // constraint in normal operation.
    await this.repository.delete({ id });
  }

  // Deliberately counts trashed (soft-deleted) tickets too, unlike every
  // other "how many active tickets reference this row" count in the app —
  // tickets.team_id is ON DELETE NO ACTION, and a soft-deleted ticket still
  // physically holds that FK. A deleted_at IS NULL filter here undercounts
  // against what the DB constraint actually checks: this guard passing
  // with only trashed tickets left would let delete() below hit a raw,
  // unhandled Postgres FK-violation instead of this friendly rejection.
  async countTicketsForTeam(teamId: string): Promise<number> {
    const rows = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM tickets WHERE team_id = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  findMemberIds(teamId: string): Promise<string[]> {
    return this.membersRepository
      .find({ where: { teamId } })
      .then((rows) => rows.map((row) => row.userId));
  }

  async findMemberIdsByTeamIds(teamIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (teamIds.length === 0) return map;
    const rows = await this.membersRepository.find({ where: { teamId: In(teamIds) } });
    for (const row of rows) {
      const list = map.get(row.teamId);
      if (list) list.push(row.userId);
      else map.set(row.teamId, [row.userId]);
    }
    return map;
  }

  // A user can technically belong to several teams (TeamsSettingsPage's
  // per-team checkbox editor allows it), but the single-select «Отдел»
  // dropdown on EditUserModal only ever shows/sets one — this returns
  // every membership row so the service layer can pick the first as that
  // single value.
  async findTeamIdsByUserIds(userIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (userIds.length === 0) return map;
    const rows = await this.membersRepository.find({ where: { userId: In(userIds) } });
    for (const row of rows) {
      const list = map.get(row.userId);
      if (list) list.push(row.teamId);
      else map.set(row.userId, [row.teamId]);
    }
    return map;
  }

  // Full replace for ONE user across ALL teams — the «Отдел» dropdown is
  // single-select, so picking a team there means "this is now their only
  // department", same "this list is now exactly this" semantics as
  // setMembers above, just sliced by user instead of by team.
  async setUserTeam(userId: string, teamId: string | null): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TeamMemberEntity, { userId });
      if (teamId) {
        await manager.insert(TeamMemberEntity, { teamId, userId });
      }
    });
  }

  // Full replace — simplest correct semantics for "this team's roster is
  // now exactly this list" from an edit form, and cheap at this scale (a
  // handful of members per team).
  async setMembers(teamId: string, userIds: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TeamMemberEntity, { teamId });
      if (userIds.length > 0) {
        await manager.insert(
          TeamMemberEntity,
          userIds.map((userId) => ({ teamId, userId })),
        );
      }
    });
  }
}
