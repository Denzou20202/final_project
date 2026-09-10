export interface NameCursor {
  fullName: string;
  id: string;
}

// Keyset pagination cursor over (fullName, id) — the id tiebreaker keeps
// paging stable when two accounts share a fullName. Distinct from the
// shared (createdAt, id) KeysetCursor in @veloxdesk/common: UsersRepository.
// findPage's search mode sorts by fullName instead of createdAt, so it needs
// its own cursor shape rather than reusing that one. `\0` (never legal in a
// name or a UUID) separates the two parts instead of `_`, which a real
// fullName could otherwise contain.
export function encodeNameCursor(cursor: NameCursor): string {
  return Buffer.from(`${cursor.fullName}\0${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeNameCursor(raw: string): NameCursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separatorIndex = decoded.lastIndexOf('\0');
  const fullName = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);

  if (!id || separatorIndex === -1) {
    throw new Error('Invalid cursor');
  }

  return { fullName, id };
}
