import { userApi } from './client.js';
import type { PublicTeam } from '../types.js';

export interface TeamInput {
  name: string;
  nameUk?: string;
  nameEn?: string;
  memberIds?: string[];
}

export async function listTeams(): Promise<PublicTeam[]> {
  const { data } = await userApi.get<PublicTeam[]>('/teams');
  return data;
}

export async function createTeam(input: TeamInput): Promise<PublicTeam> {
  const { data } = await userApi.post<PublicTeam>('/teams', input);
  return data;
}

export async function updateTeam(id: string, input: Partial<TeamInput>): Promise<PublicTeam> {
  const { data } = await userApi.patch<PublicTeam>(`/teams/${id}`, input);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  await userApi.delete(`/teams/${id}`);
}

// Single-select «Отдел» dropdown on EditUserModal — replaces the user's
// team memberships with exactly this one (null clears them out entirely).
export async function assignUserTeam(userId: string, teamId: string | null): Promise<void> {
  await userApi.patch(`/users/${userId}/team`, { teamId });
}
