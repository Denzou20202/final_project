import { userApi } from './client.js';
import type { PresenceSettings, PublicEmployeeStatus, PublicStatusHistoryEntry } from '../types.js';

export interface EmployeeStatusInput {
  name: string;
  nameUk?: string;
  nameEn?: string;
  color: string;
}

export async function listEmployeeStatuses(): Promise<PublicEmployeeStatus[]> {
  const { data } = await userApi.get<PublicEmployeeStatus[]>('/employee-statuses');
  return data;
}

export async function createEmployeeStatus(input: EmployeeStatusInput): Promise<PublicEmployeeStatus> {
  const { data } = await userApi.post<PublicEmployeeStatus>('/employee-statuses', input);
  return data;
}

export async function updateEmployeeStatus(id: string, input: Partial<EmployeeStatusInput>): Promise<PublicEmployeeStatus> {
  const { data } = await userApi.patch<PublicEmployeeStatus>(`/employee-statuses/${id}`, input);
  return data;
}

export async function deleteEmployeeStatus(id: string): Promise<void> {
  await userApi.delete(`/employee-statuses/${id}`);
}

export async function fetchPresenceSettings(): Promise<PresenceSettings> {
  const { data } = await userApi.get<PresenceSettings>('/employee-statuses/settings');
  return data;
}

export async function updatePresenceSettings(inactivityTimeoutMinutes: number): Promise<PresenceSettings> {
  const { data } = await userApi.patch<PresenceSettings>('/employee-statuses/settings', { inactivityTimeoutMinutes });
  return data;
}

export async function fetchStatusHistory(userId: string): Promise<PublicStatusHistoryEntry[]> {
  const { data } = await userApi.get<PublicStatusHistoryEntry[]>(`/users/${userId}/status-history`);
  return data;
}
