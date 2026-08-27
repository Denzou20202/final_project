import type * as OpenidClient from 'openid-client';

// openid-client v6's discovery() fetches the IdP's
// /.well-known/openid-configuration document — worth caching briefly rather
// than re-fetching on every login/callback, but short enough that an admin
// editing the config sees it take effect quickly without a service restart.
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  key: string;
  config: OpenidClient.Configuration;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface OidcClientParams {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
}

// openid-client (and its transitive deps jose/oauth4webapi) ship ESM-only —
// a top-level `import` would make Jest try to `require()` it and fail
// ("Cannot use import statement outside a module"), so this is loaded via
// dynamic import instead, both here and in oidc-auth.controller.ts. Only
// paid for once per test-file load; nothing in this module runs at import
// time anyway.
async function loadOpenidClient(): Promise<typeof OpenidClient> {
  return import('openid-client');
}

// Keyed by audience (there are at most 2 configs — staff/client — so a
// plain Map is plenty). Re-fetches discovery whenever the cached entry's
// params no longer match (an admin just changed issuer/clientId/secret) or
// it's older than CACHE_TTL_MS.
export async function getOidcClientConfig(audience: string, params: OidcClientParams): Promise<OpenidClient.Configuration> {
  const key = `${params.issuerUrl}::${params.clientId}::${params.clientSecret}`;
  const cached = cache.get(audience);
  if (cached && cached.key === key && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  const client = await loadOpenidClient();
  const config = await client.discovery(new URL(params.issuerUrl), params.clientId, {
    client_secret: params.clientSecret,
  });
  cache.set(audience, { key, config, fetchedAt: Date.now() });
  return config;
}
