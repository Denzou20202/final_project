import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignPermissionGroup,
  createPermissionGroup,
  deletePermissionGroup,
  listPermissionGroups,
  PermissionGroupInput,
  resetTwoFactor,
  updatePermissionGroup,
} from '../lib/api/permission-groups.api.js';

export function usePermissionGroups() {
  return useQuery({
    queryKey: ['permission-groups'],
    queryFn: listPermissionGroups,
    staleTime: 60_000,
  });
}

export function useCreatePermissionGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PermissionGroupInput) => createPermissionGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['permission-groups'] }),
  });
}

export function useUpdatePermissionGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<PermissionGroupInput>) => updatePermissionGroup(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['permission-groups'] }),
  });
}

export function useDeletePermissionGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePermissionGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['permission-groups'] }),
  });
}

// Shares the ['users'] query key with useUsers.ts's mutations so the Users
// page and the assignee pickers refresh together after either action.
export function useAssignPermissionGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissionGroupId }: { userId: string; permissionGroupId: string | null }) =>
      assignPermissionGroup(userId, permissionGroupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetTwoFactor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
