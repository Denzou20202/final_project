import type { AuthAudience } from '@veloxdesk/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOidcConfig, testOidcConnection, upsertOidcConfig, UpsertOidcConfigPayload } from '../lib/api/oidc-config.api.js';

export function useOidcConfig(audience: AuthAudience) {
  return useQuery({
    queryKey: ['oidc-config', audience],
    queryFn: () => getOidcConfig(audience),
    staleTime: 30_000,
  });
}

export function useUpsertOidcConfig(audience: AuthAudience) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertOidcConfigPayload) => upsertOidcConfig(audience, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oidc-config', audience] }),
  });
}

export function useTestOidcConnection(audience: AuthAudience) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testOidcConnection(audience),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['oidc-config', audience] }),
  });
}
