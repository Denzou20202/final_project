import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTagToTicket,
  deleteTag,
  listAllTags,
  listTicketTags,
  removeTagFromTicket,
  renameTag,
} from '../lib/api/tags.api.js';

export function useAllTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: listAllTags,
    staleTime: 30_000,
  });
}

export function useTicketTags(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket', ticketId, 'tags'],
    queryFn: () => listTicketTags(ticketId as string),
    enabled: !!ticketId,
  });
}

export function useAddTag(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => addTagToTicket(ticketId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'tags'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'activity'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useRemoveTag(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => removeTagFromTicket(ticketId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'tags'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'activity'] });
    },
  });
}

export function useRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, nameUk, nameEn }: { id: string; name: string; nameUk?: string; nameEn?: string }) =>
      renameTag(id, name, nameUk, nameEn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-counts', 'by-tag'] });
    },
  });
}
