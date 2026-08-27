import { Client } from 'ldapts';

// Plaintext connection params — the caller (LdapConfigService for
// test-connection, LdapAuthProvider for a real login) is responsible for
// decrypting bindPassword out of LdapConfigEntity.bindPasswordEncrypted
// before building this; this module never touches ciphertext or the
// entity/repository layer, so it's equally usable from either call site.
export interface LdapConnectionParams {
  url: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  userFilterTemplate: string;
  emailAttribute: string;
  fullNameAttribute: string;
  externalIdAttribute: string;
  tlsRejectUnauthorized: boolean;
}

export interface LdapIdentity {
  externalId: string;
  email: string;
  fullName: string;
}

const CONNECT_TIMEOUT_MS = 5000;
const OPERATION_TIMEOUT_MS = 10000;

function buildClient(params: LdapConnectionParams): Client {
  return new Client({
    url: params.url,
    connectTimeout: CONNECT_TIMEOUT_MS,
    timeout: OPERATION_TIMEOUT_MS,
    tlsOptions: { rejectUnauthorized: params.tlsRejectUnauthorized },
  });
}

// {{username}} is the only placeholder supported — deliberately simple
// rather than a general template engine, and the substituted value is
// always escaped through ldapts' own Filter.escape via escapeFilter-style
// handling below to prevent LDAP filter injection from a submitted login.
const LDAP_FILTER_SPECIAL_CHARS = new Set(['\\', '*', '(', ')', ' ']);

function buildUserFilter(template: string, username: string): string {
  const escaped = [...username]
    .map((char) => (LDAP_FILTER_SPECIAL_CHARS.has(char) ? `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}` : char))
    .join('');
  return template.replaceAll('{{username}}', escaped);
}

function attributeToExternalId(entry: Record<string, unknown>, attribute: string): string | null {
  const raw = entry[attribute];
  if (raw == null) return null;
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.isBuffer((raw as unknown[])?.[0]) ? ((raw as Buffer[])[0]) : null;
  if (buffer) return buffer.toString('hex');
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : null;
}

function attributeToString(entry: Record<string, unknown>, attribute: string): string | null {
  const raw = entry[attribute];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : null;
}

// Service-account bind + a trivial search (sizeLimit 1) against searchBase —
// confirms the bind DN/password AND the search base/filter are all usable,
// not just that the server is reachable. Never throws; the caller (admin
// "Test connection" button) wants a message, not an exception.
export async function testLdapConnection(params: LdapConnectionParams): Promise<{ success: true } | { success: false; error: string }> {
  const client = buildClient(params);
  try {
    await client.bind(params.bindDn, params.bindPassword);
    await client.search(params.searchBase, { scope: 'sub', filter: '(objectClass=*)', sizeLimit: 1, paged: false });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown LDAP error' };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

// Search-then-bind: AD/LDAP login names (sAMAccountName/UPN/mail) usually
// aren't the entry's DN, so the service account finds the entry first, then
// a SECOND bind as that entry's own DN with the submitted password is what
// actually verifies the credential. Returns null (never throws) for any
// failure mode — wrong password, unknown user, ambiguous match, or an
// unreachable directory — so AuthService can give one uniform
// "Invalid email or password" regardless of which one occurred.
export async function findAndBindLdapUser(
  params: LdapConnectionParams,
  username: string,
  password: string,
): Promise<LdapIdentity | null> {
  if (!password) return null;
  const searchClient = buildClient(params);
  let entryDn: string;
  let identity: Omit<LdapIdentity, 'externalId'> & { externalId: string | null };
  try {
    await searchClient.bind(params.bindDn, params.bindPassword);
    const { searchEntries } = await searchClient.search(params.searchBase, {
      scope: 'sub',
      filter: buildUserFilter(params.userFilterTemplate, username),
      sizeLimit: 2,
      explicitBufferAttributes: [params.externalIdAttribute],
      attributes: [params.emailAttribute, params.fullNameAttribute, params.externalIdAttribute],
    });
    // Zero matches: no such user. More than one: an ambiguous filter/search
    // base — either way this login attempt cannot be resolved to exactly
    // one directory identity.
    if (searchEntries.length !== 1) return null;
    const entry = searchEntries[0] as unknown as Record<string, unknown>;
    entryDn = entry.dn as string;
    const email = attributeToString(entry, params.emailAttribute);
    const fullName = attributeToString(entry, params.fullNameAttribute);
    const externalId = attributeToExternalId(entry, params.externalIdAttribute);
    if (!email || !fullName || !externalId) return null;
    identity = { email, fullName, externalId };
  } catch {
    return null;
  } finally {
    await searchClient.unbind().catch(() => undefined);
  }

  const userClient = buildClient(params);
  try {
    await userClient.bind(entryDn, password);
  } catch {
    return null;
  } finally {
    await userClient.unbind().catch(() => undefined);
  }

  return identity as LdapIdentity;
}
