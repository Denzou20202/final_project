import type { DecodedJwtPayload } from './jwt.js';

export interface TicketVisibilityFields {
  createdBy: string;
  assignedTo?: string | null;
  teamId?: string | null;
}

// Mirrors staffCanSeeTicket (libs/common/src/permissions/staff-ticket-visibility.ts)
// one-to-one — reimplemented here rather than imported, since that package
// pulls in NestJS-oriented code not meant for a browser bundle. Only used
// client-side to decide whether to react to an unfiltered broadcast event
// (sidebar folder highlighting) — never a real access-control boundary; the
// server already enforces the real one on every REST/list/count endpoint.
export function canSeeTicket(actor: DecodedJwtPayload, ticket: TicketVisibilityFields): boolean {
  if (actor.restrictToOwnTickets && ticket.assignedTo !== actor.sub && ticket.createdBy !== actor.sub) {
    return false;
  }
  if (actor.restrictToDepartments && (!ticket.teamId || !(actor.departmentIds ?? []).includes(ticket.teamId))) {
    return false;
  }
  return true;
}
