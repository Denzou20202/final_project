import { TeamEntity } from '@veloxdesk/database';

export interface PublicTeam {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  memberIds: string[];
  createdAt: Date;
}

export function toPublicTeam(team: TeamEntity, memberIds: string[] = []): PublicTeam {
  return {
    id: team.id,
    name: team.name,
    nameUk: team.nameUk ?? null,
    nameEn: team.nameEn ?? null,
    memberIds,
    createdAt: team.createdAt,
  };
}
