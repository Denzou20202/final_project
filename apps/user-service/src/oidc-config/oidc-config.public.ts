import { OidcConfigEntity } from '@veloxdesk/database';
import { AuthAudience, UserRole } from '@veloxdesk/types';

// Never includes clientSecretEncrypted — the admin form shows only whether
// a secret is currently set (hasClientSecret), never the value itself.
export interface PublicOidcConfig {
  audience: AuthAudience;
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scopes: string;
  emailClaim: string;
  fullNameClaim: string;
  defaultRole: UserRole;
  lastTestSuccessAt: Date | null;
  lastTestError: string | null;
  updatedAt: Date;
}

export function toPublicOidcConfig(config: OidcConfigEntity): PublicOidcConfig {
  return {
    audience: config.audience,
    enabled: config.enabled,
    issuerUrl: config.issuerUrl,
    clientId: config.clientId,
    hasClientSecret: !!config.clientSecretEncrypted,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    emailClaim: config.emailClaim,
    fullNameClaim: config.fullNameClaim,
    defaultRole: config.defaultRole,
    lastTestSuccessAt: config.lastTestSuccessAt ?? null,
    lastTestError: config.lastTestError ?? null,
    updatedAt: config.updatedAt,
  };
}
