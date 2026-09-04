import type { Locale, UserRole } from '@veloxdesk/types';
import { userApi } from './client.js';
import type { PublicUser, PublicUserPage } from '../types.js';

export async function fetchMe(): Promise<PublicUser> {
  const { data } = await userApi.get<PublicUser>('/users/me');
  return data;
}

// Self-service — distinct from updateUserProfile(id, ...) below, which is
// the admin-only PATCH /users/:id. A partial patch (not one param per
// field): ProfileTab and LanguageTab each save independently, and neither
// should have to resend the other's current value just to avoid
// overwriting it.
export async function updateOwnProfile(patch: { computerName?: string; locale?: Locale }): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>('/users/me', patch);
  return data;
}

// Backs the settings modal's «Telegram» tab — same endpoint client-portal's
// ProfileTab already uses, no role restriction on the backend.
export async function createTelegramLinkToken(): Promise<{ link: string; expiresAt: string }> {
  const { data } = await userApi.post<{ link: string; expiresAt: string }>('/users/me/telegram-link-token');
  return data;
}

// Operators/admins only — used to populate the "assign to" picker.
export async function fetchUsers(cursor?: string): Promise<PublicUserPage> {
  const { data } = await userApi.get<PublicUserPage>('/users', { params: { cursor, limit: 100 } });
  return data;
}

// Backs an async-search picker (ReportFiltersForm's client filter) — the
// plain cursor page above only ever reaches the first `limit` accounts by
// createdAt, which for a 1000+-client deployment excludes almost everyone.
export async function searchUsers(query: string, limit = 20): Promise<PublicUserPage> {
  const { data } = await userApi.get<PublicUserPage>('/users', { params: { search: query, limit } });
  return data;
}

// Backs the admin Users table (UsersPage.tsx) — real Prev/Next through every
// account, optionally filtered by the same free-text search as searchUsers
// above. Distinct from both fetchUsers (a single page-of-100, for pickers)
// and searchUsers (a typeahead's top-N, no further paging): this one always
// forwards `cursor`, so the backend keyset-pages through search results too
// instead of returning only the first match batch.
export async function fetchUsersPage(params: { cursor?: string; search?: string; limit: number }): Promise<PublicUserPage> {
  const { data } = await userApi.get<PublicUserPage>('/users', { params });
  return data;
}

// Admin-only on the backend — self-service /auth/register always creates a
// client, this is the only way to get an operator/admin account onto the
// system without touching SQL directly.
export async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  cannotManageAdmins?: boolean;
  isVip?: boolean;
}): Promise<PublicUser> {
  const { data } = await userApi.post<PublicUser>('/users', input);
  return data;
}

export async function updateUserRole(id: string, role: UserRole): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>(`/users/${id}/role`, { role });
  return data;
}

export async function setAdminRestriction(id: string, cannotManageAdmins: boolean): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>(`/users/${id}/admin-restriction`, { cannotManageAdmins });
  return data;
}

export async function setVip(id: string, isVip: boolean): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>(`/users/${id}/vip`, { isVip });
  return data;
}

export interface UpdateUserProfileInput {
  fullName?: string;
  computerName?: string;
  position?: string;
  department?: string;
  company?: string;
  city?: string;
  phone?: string;
}

export async function updateUserProfile(id: string, input: UpdateUserProfileInput): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>(`/users/${id}`, input);
  return data;
}

// Admin-only — there's no separate self-service "forgot password" flow, so
// this same endpoint doubles as one: an admin can target their own id here
// too (see SecurityTab.tsx), which is what currentPassword/totpCode are
// for — the backend only requires (and only checks) them when the target
// id is the caller's own; resetting someone ELSE's password (the
// locked-out-colleague recovery case) needs neither.
export async function resetUserPassword(
  id: string,
  password: string,
  currentPassword?: string,
  totpCode?: string,
): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>(`/users/${id}/password`, { password, currentPassword, totpCode });
  return data;
}

export async function deactivateUser(id: string): Promise<PublicUser> {
  const { data } = await userApi.post<PublicUser>(`/users/${id}/deactivate`);
  return data;
}

export async function reactivateUser(id: string): Promise<PublicUser> {
  const { data } = await userApi.post<PublicUser>(`/users/${id}/reactivate`);
  return data;
}

// Permanent — see UsersService.hardDelete. Unlike deactivateUser, this is
// only ever offered for a client/operator/restricted-admin target.
export async function deleteUser(id: string): Promise<void> {
  await userApi.delete(`/users/${id}`);
}

// Admin-only — self-registrations awaiting a decision, feeds the sidebar
// bell/modal.
export async function fetchPendingRegistrations(): Promise<PublicUser[]> {
  const { data } = await userApi.get<PublicUser[]>('/users/pending');
  return data;
}

export async function approveRegistration(id: string): Promise<PublicUser> {
  const { data } = await userApi.post<PublicUser>(`/users/${id}/approve`);
  return data;
}

export async function rejectRegistration(id: string): Promise<void> {
  await userApi.post(`/users/${id}/reject`);
}
