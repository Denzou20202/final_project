import type { PublicTicketStatus } from './types.js';

// The URL shows a status's position in the admin-configured order (1, 2, 3…)
// instead of its raw uuid — position is derived from index in the already
// sortOrder-ASC-sorted list, not the raw sortOrder value itself, since
// sortOrder can develop gaps after a status is deleted (nextSortOrder()
// always appends MAX+1, nothing ever compacts the remaining rows).
export function statusUrlPosition(statusId: string, statuses: PublicTicketStatus[] | undefined): number | undefined {
  const index = statuses?.findIndex((s) => s.id === statusId) ?? -1;
  return index >= 0 ? index + 1 : undefined;
}

// Resolves a `statusId` URL param back to the real uuid. A numeric param is
// the new position format; anything else is treated as an already-real uuid
// (the pre-existing format) so old bookmarks and localStorage-saved filter
// presets keep working without any migration.
export function resolveStatusIdParam(raw: string | null, statuses: PublicTicketStatus[] | undefined): string | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const status = statuses?.[Number(raw) - 1];
    return status ? status.id : null;
  }
  return raw;
}
