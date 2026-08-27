import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTicketCategory,
  deleteTicketCategory,
  listTicketCategories,
  renameTicketCategory,
} from '../lib/api/ticket-categories.api.js';

export function useTicketCategories() {
  return useQuery({
    queryKey: ['ticket-categories'],
    queryFn: listTicketCategories,
    staleTime: 60_000,
  });
}

export function useCreateTicketCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, nameUk, nameEn }: { name: string; nameUk?: string; nameEn?: string }) =>
      createTicketCategory(name, nameUk, nameEn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-categories'] }),
  });
}

export function useRenameTicketCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, nameUk, nameEn }: { id: string; name: string; nameUk?: string; nameEn?: string }) =>
      renameTicketCategory(id, name, nameUk, nameEn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-categories'] }),
  });
}

export function useDeleteTicketCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTicketCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-categories'] }),
  });
}
