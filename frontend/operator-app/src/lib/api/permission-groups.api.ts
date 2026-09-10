import { userApi } from './client.js';
import type { PublicPermissionGroup } from '../types.js';

export interface PermissionGroupInput {
  name: string;
  restrictToDepartments?: boolean;
  departmentIds?: string[];
  restrictToOwnTickets?: boolean;
  cannotBeAssignee?: boolean;
  requireTwoFactor?: boolean;
  ipWhitelist?: string[];
}

export async function listPermissionGroups(): Promise<PublicPermissionGroup[]> {
  const { data } = await userApi.get<PublicPermissionGroup[]>('/permission-groups');
  return data;
}

export async function createPermissionGroup(input: PermissionGroupInput): Promise<PublicPermissionGroup> {
  const { data } = await userApi.post<PublicPermissionGroup>('/permission-groups', input);
  return data;
}

export async function updatePermissionGroup(
  id: string,
  input: Partial<PermissionGroupInput>,
): Promise<PublicPermissionGroup> {
  const { data } = await userApi.patch<PublicPermissionGroup>(`/permission-groups/${id}`, input);
  return data;
}

export async function deletePermissionGroup(id: string): Promise<void> {
  await userApi.delete(`/permission-groups/${id}`);
}

export async function assignPermissionGroup(userId: string, permissionGroupId: string | null): Promise<void> {
  await userApi.patch(`/users/${userId}/permission-group`, { permissionGroupId });
}

export async function resetTwoFactor(userId: string): Promise<void> {
  await userApi.post(`/users/${userId}/reset-2fa`);
}
