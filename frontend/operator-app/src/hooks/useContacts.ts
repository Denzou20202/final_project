import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { downloadContactsCsv, fetchDuplicateContacts, mergeContacts } from '../lib/api/contacts.api.js';

export function useDownloadContactsCsv() {
  return useMutation({ mutationFn: downloadContactsCsv });
}

// Enabled only while the duplicates modal is open — the underlying scan
// walks every client account, no need to run it on every Users page visit.
export function useDuplicateContacts(enabled: boolean) {
  return useQuery({
    queryKey: ['contacts', 'duplicates'],
    queryFn: fetchDuplicateContacts,
    enabled,
  });
}

export function useMergeContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mergeContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'duplicates'] });
      // The merged loser now shows as deactivated / the primary may have
      // gained a mergedIntoId-visible neighbor — refresh the Users list too.
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
