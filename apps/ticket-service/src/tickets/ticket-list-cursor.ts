// Generalized keyset cursor for the ticket list — unlike the shared
// {createdAt, id} cursor in @veloxdesk/common (fixed sort order), this one
// carries whatever column the caller is currently sorting by, so paging
// stays stable no matter which column/direction is active. sortValue is
// JSON-encoded rather than string-concatenated so its type (string for
// title/date-ISO, number for ticketNumber/priority-rank/status-rank) round
// trips exactly — string comparison of numbers sorts "10" before "9".
export interface TicketListCursor {
  sortValue: string | number;
  id: string;
}

export function encodeTicketListCursor(cursor: TicketListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeTicketListCursor(raw: string): TicketListCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid cursor');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as TicketListCursor).id !== 'string' ||
    !['string', 'number'].includes(typeof (parsed as TicketListCursor).sortValue)
  ) {
    throw new Error('Invalid cursor');
  }

  return parsed as TicketListCursor;
}
