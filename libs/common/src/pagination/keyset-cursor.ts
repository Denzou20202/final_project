export interface KeysetCursor {
  createdAt: Date;
  id: string;
}

// Keyset pagination cursor over (created_at, id) — the id tiebreaker keeps
// paging stable even when two rows share the same created_at timestamp.
// Shared across services/entities that list by createdAt DESC, id DESC.
export function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}_${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): KeysetCursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separatorIndex = decoded.lastIndexOf('_');
  const isoDate = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);
  const createdAt = new Date(isoDate);

  if (!id || Number.isNaN(createdAt.getTime())) {
    throw new Error('Invalid cursor');
  }

  return { createdAt, id };
}
