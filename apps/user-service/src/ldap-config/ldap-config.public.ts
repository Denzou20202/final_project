import { LdapConfigEntity } from '@veloxdesk/database';
import { AuthAudience, UserRole } from '@veloxdesk/types';

// Never includes bindPasswordEncrypted — the admin form shows only whether
// a secret is currently set (hasBindPassword), never the value itself.
export interface PublicLdapConfig {
  audience: AuthAudience;
  enabled: boolean;
  url: string;
  bindDn: string;
  hasBindPassword: boolean;
  searchBase: string;
  userFilterTemplate: string;
  emailAttribute: string;
  fullNameAttribute: string;
  externalIdAttribute: string;
  tlsRejectUnauthorized: boolean;
  defaultRole: UserRole;
  lastTestSuccessAt: Date | null;
  lastTestError: string | null;
  updatedAt: Date;
}

export function toPublicLdapConfig(config: LdapConfigEntity): PublicLdapConfig {
  return {
    audience: config.audience,
    enabled: config.enabled,
    url: config.url,
    bindDn: config.bindDn,
    hasBindPassword: !!config.bindPasswordEncrypted,
    searchBase: config.searchBase,
    userFilterTemplate: config.userFilterTemplate,
    emailAttribute: config.emailAttribute,
    fullNameAttribute: config.fullNameAttribute,
    externalIdAttribute: config.externalIdAttribute,
    tlsRejectUnauthorized: config.tlsRejectUnauthorized,
    defaultRole: config.defaultRole,
    lastTestSuccessAt: config.lastTestSuccessAt ?? null,
    lastTestError: config.lastTestError ?? null,
    updatedAt: config.updatedAt,
  };
}
