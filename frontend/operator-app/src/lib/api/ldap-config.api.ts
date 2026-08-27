import type { AuthAudience, UserRole } from '@veloxdesk/types';
import { userApi } from './client.js';
import type { PublicLdapConfig } from '../types.js';

export interface UpsertLdapConfigPayload {
  url: string;
  bindDn: string;
  bindPassword?: string;
  searchBase: string;
  userFilterTemplate?: string;
  emailAttribute?: string;
  fullNameAttribute?: string;
  externalIdAttribute?: string;
  tlsRejectUnauthorized?: boolean;
  defaultRole: UserRole;
  enabled?: boolean;
}

export async function getLdapConfig(audience: AuthAudience): Promise<PublicLdapConfig | null> {
  const { data } = await userApi.get<PublicLdapConfig | null>(`/ldap-config/${audience}`);
  return data;
}

export async function upsertLdapConfig(audience: AuthAudience, payload: UpsertLdapConfigPayload): Promise<PublicLdapConfig> {
  const { data } = await userApi.put<PublicLdapConfig>(`/ldap-config/${audience}`, payload);
  return data;
}

export async function testLdapConnection(audience: AuthAudience): Promise<{ success: boolean; error?: string }> {
  const { data } = await userApi.post<{ success: boolean; error?: string }>(`/ldap-config/${audience}/test-connection`);
  return data;
}
