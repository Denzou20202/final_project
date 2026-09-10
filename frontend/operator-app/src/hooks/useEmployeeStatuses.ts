import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEmployeeStatus,
  deleteEmployeeStatus,
  EmployeeStatusInput,
  fetchPresenceSettings,
  fetchStatusHistory,
  listEmployeeStatuses,
  updateEmployeeStatus,
  updatePresenceSettings,
} from '../lib/api/employee-statuses.api.js';

export function useEmployeeStatuses() {
  return useQuery({
    queryKey: ['employee-statuses'],
    queryFn: listEmployeeStatuses,
    staleTime: 60_000,
  });
}

export function useCreateEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeStatusInput) => createEmployeeStatus(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-statuses'] }),
  });
}

export function useUpdateEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<EmployeeStatusInput>) => updateEmployeeStatus(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-statuses'] }),
  });
}

export function useDeleteEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmployeeStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-statuses'] }),
  });
}

// Read by every staff member (the status picker + the client-side idle
// timer both need the threshold), written by admins only.
export function usePresenceSettings() {
  return useQuery({
    queryKey: ['presence-settings'],
    queryFn: fetchPresenceSettings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePresenceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePresenceSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presence-settings'] }),
  });
}

export function useStatusHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['status-history', userId],
    queryFn: () => fetchStatusHistory(userId as string),
    enabled: !!userId,
  });
}
