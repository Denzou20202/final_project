import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  listCustomFieldDefinitions,
  listTicketCustomFieldValues,
  setTicketCustomFieldValue,
  updateCustomFieldDefinition,
} from '../lib/api/custom-fields.api.js';

export function useCustomFieldDefinitions() {
  return useQuery({
    queryKey: ['custom-fields'],
    queryFn: listCustomFieldDefinitions,
    staleTime: 60_000,
  });
}

export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomFieldDefinition,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}

export function useUpdateCustomFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Parameters<typeof updateCustomFieldDefinition>[1] & { id: string }) =>
      updateCustomFieldDefinition(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}

export function useDeleteCustomFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomFieldDefinition,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}

export function useTicketCustomFieldValues(ticketId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'custom-field-values'],
    queryFn: () => listTicketCustomFieldValues(ticketId),
  });
}

export function useSetTicketCustomFieldValue(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, value }: { fieldId: string; value: string }) =>
      setTicketCustomFieldValue(ticketId, fieldId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', ticketId, 'custom-field-values'] }),
  });
}
