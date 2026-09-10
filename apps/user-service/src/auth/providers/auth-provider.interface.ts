import { AuthAudience } from '@veloxdesk/types';
import { AuthenticatedIdentity } from '../../users/directory-identity.js';

export type { AuthenticatedIdentity };

// Implemented by LdapAuthProvider. OIDC deliberately does NOT implement
// this — it's a redirect-based flow (authorization code + callback), not a
// synchronous username/password check, so it gets its own controller
// instead (see oidc-auth.controller.ts).
export interface DirectoryCredentialProvider {
  // Returns null on invalid credentials or an unreachable/misconfigured
  // directory — never throws for that, so callers can give a uniform
  // "Invalid email or password" without leaking which failure mode occurred.
  validate(username: string, password: string, audience: AuthAudience): Promise<AuthenticatedIdentity | null>;
}
