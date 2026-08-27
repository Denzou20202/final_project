import type { UserRole } from '@veloxdesk/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUser,
  deactivateUser,
  deleteUser,
  fetchUsers,
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

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useSetAdminRestriction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cannotManageAdmins }: { id: string; cannotManageAdmins: boolean }) =>
      setAdminRestriction(id, cannotManageAdmins),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useSetVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVip }: { id: string; isVip: boolean }) => setVip(id, isVip),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateUserProfileInput) => updateUserProfile(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password, currentPassword, totpCode }: { id: string; password: string; currentPassword?: string; totpCode?: string }) =>
      resetUserPassword(id, password, currentPassword, totpCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

// «Удалить» in the Users list — soft-deactivate, not a real delete (see
// backend). Shares the ['users'] query key so the row updates in place with
// a "деактивирован" badge instead of vanishing.
export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

// Permanent — EditUserModal's «Удалить» button (see UsersService.hardDelete
// for the backend cascade). Distinct from useDeactivateUser above.
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
