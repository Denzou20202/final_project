import type { AuthAudience, UserRole } from '@veloxdesk/types';
import { userApi } from './client.js';
import type { PublicOidcConfig } from '../types.js';

export interface UpsertOidcConfigPayload {
  issuerUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes?: string;
  emailClaim?: string;
  fullNameClaim?: string;
  defaultRole: UserRole;
  enabled?: boolean;
}

export async function getOidcConfig(audience: AuthAudience): Promise<PublicOidcConfig | null> {
  const { data } = await userApi.get<PublicOidcConfig | null>(`/oidc-config/${audience}`);
  return data;
}

export async function upsertOidcConfig(audience: AuthAudience, payload: UpsertOidcConfigPayload): Promise<PublicOidcConfig> {
  const { data } = await userApi.put<PublicOidcConfig>(`/oidc-config/${audience}`, payload);
  return data;
}

export async function testOidcConnection(audience: AuthAudience): Promise<{ success: boolean; error?: string }> {
  const { data } = await userApi.post<{ success: boolean; error?: string }>(`/oidc-config/${audience}/test-connection`);
  return data;
}
