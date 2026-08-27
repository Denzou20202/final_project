import type { AuthAudience } from '@veloxdesk/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLdapConfig, testLdapConnection, upsertLdapConfig, UpsertLdapConfigPayload } from '../lib/api/ldap-config.api.js';

export function useLdapConfig(audience: AuthAudience) {
  return useQuery({
    queryKey: ['ldap-config', audience],
    queryFn: () => getLdapConfig(audience),
    staleTime: 30_000,
  });
}

export function useUpsertLdapConfig(audience: AuthAudience) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertLdapConfigPayload) => upsertLdapConfig(audience, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ldap-config', audience] }),
  });
}

export function useTestLdapConnection(audience: AuthAudience) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testLdapConnection(audience),
    // Refetch the config afterward — testConnection persists
    // lastTestSuccessAt/lastTestError server-side, and the "must test
    // before enabling" guard on the next save depends on that being fresh.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ldap-config', audience] }),
  });
}
