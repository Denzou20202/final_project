import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignUserTeam, createTeam, deleteTeam, listTeams, TeamInput, updateTeam } from '../lib/api/teams.api.js';

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    staleTime: 60_000,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TeamInput) => createTeam(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<TeamInput>) => updateTeam(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
}

// Shares the ['users'] query key with useUsers.ts's mutations (Users page
// refresh) and also invalidates ['teams'] — the picked team's own roster
// changed too.
export function useAssignUserTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string | null }) => assignUserTeam(userId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
