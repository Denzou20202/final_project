import { AuthAudience } from '@veloxdesk/types';

// This service otherwise stays fully stateless-JWT (Bearer access/refresh
// tokens only, no session cookies) — this is the one exception, needed
// because the OIDC authorization-code+PKCE flow spans two separate
// requests (/login redirect, then /callback) with no session store to hold
// the verifier/state/nonce between them. Scoped to /api/auth/oidc via the
// cookie's `path` so it's never sent on any other request.
export const OIDC_STATE_COOKIE_NAME = 'veloxdesk_oidc_state';
export const OIDC_STATE_COOKIE_PATH = '/api/auth/oidc';
export const OIDC_STATE_TOKEN_TTL = '5m';

export interface OidcStateTokenPayload {
  audience: AuthAudience;
  state: string;
  nonce: string;
  codeVerifier: string;
}
