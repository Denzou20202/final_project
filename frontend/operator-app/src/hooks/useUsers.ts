import type { UserRole } from '@veloxdesk/types';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  createUser,
  deactivateUser,
  deleteUser,
  fetchUsers,
  fetchUsersPage,
  reactivateUser,
  resetUserPassword,
  searchUsers,
  setAdminRestriction,
  setVip,
  updateUserProfile,
  updateUserRole,
  type UpdateUserProfileInput,
} from '../lib/api/users.api.js';

// Single page (limit 100) is enough for the assignee picker at this scale
// (10-50 operators per prompt.md) — worth revisiting with search/pagination
// if that assumption changes. Also backs the admin-only «Пользователи»
// page, sharing the same query key so creating a user or changing a role
// refreshes the assignee picker too, not just the users page.
export function useAssignableUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
    staleTime: 60_000,
  });
}

// Backs an async-search picker (see searchUsers's own comment) — the
// caller is expected to already have debounced `query` and gated `enabled`
// on a minimum length, same as every other search-as-you-type input in
// this app.
export function useUserSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['users-search', query],
    queryFn: () => searchUsers(query),
    enabled,
    staleTime: 30_000,
  });
}

// Backs UsersPage's paginated table — real Prev/Next through every account
// (search or not), mirroring useTicketsPage's cursor-per-page-index pattern
// in TicketsPage.tsx. Distinct from useAssignableUsers (single page-of-100,
// used by pickers) and useUserSearch (typeahead dropdown, top-N only, no
// paging).
export function useUsersPage(search: string, cursor: string | undefined, limit: number) {
  return useQuery({
    queryKey: ['users-page', search, cursor, limit],
    queryFn: () => fetchUsersPage({ cursor, search: search || undefined, limit }),
    // Keep the current rows on screen while the next page/search result
    // loads — same reasoning as useTicketsPage: otherwise every Prev/Next
    // click blanks the table into a spinner for a beat before repainting.
    placeholderData: keepPreviousData,
  });
}

// Every mutation below can change who shows up in either list — invalidate
// both, not just ['users'], or UsersPage's table would keep showing stale
// rows after e.g. deactivating someone until an unrelated refetch happened.
function invalidateUsers(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['users'] });
  queryClient.invalidateQueries({ queryKey: ['users-page'] });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useSetAdminRestriction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cannotManageAdmins }: { id: string; cannotManageAdmins: boolean }) =>
      setAdminRestriction(id, cannotManageAdmins),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useSetVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVip }: { id: string; isVip: boolean }) => setVip(id, isVip),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateUserProfileInput) => updateUserProfile(id, input),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password, currentPassword, totpCode }: { id: string; password: string; currentPassword?: string; totpCode?: string }) =>
      resetUserPassword(id, password, currentPassword, totpCode),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

// «Удалить» in the Users list — soft-deactivate, not a real delete (see
// backend). Shares the ['users'] query key so the row updates in place with
// a "деактивирован" badge instead of vanishing.
export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => invalidateUsers(queryClient),
  });
}

// Permanent — EditUserModal's «Удалить» button (see UsersService.hardDelete
// for the backend cascade). Distinct from useDeactivateUser above.
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => invalidateUsers(queryClient),
  });
}
