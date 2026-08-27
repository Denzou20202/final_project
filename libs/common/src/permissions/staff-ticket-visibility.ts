import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

// The minimal slice of a ticket the visibility decision needs — lets every
// service pass its own entity/row shape without depending on ticket-service.
export interface TicketVisibilityFields {
  createdBy: string;
  assignedTo?: string | null;
  teamId?: string | null;
}

// Single source of truth for "may this staff actor see this ticket at all"
// under permission-group restrictions — the per-row twin of the SQL the
// ticket list applies (ticket-service, tickets.repository.ts
// applyRestrictions). Every by-id path (REST single-ticket reads and
// mutations, chat room join, search hits) must agree with the list, or a
// restricted operator could reach through a direct UUID what the list
// hides from them.
//
// Clients are scoped by createdBy elsewhere — call this only for
// operator/admin actors. Note the department branch deliberately hides
// tickets with NO team from department-restricted staff: the list's
// `teamId IN (...)` can never match NULL, and this must never be more
// permissive than the list.
export function staffCanSeeTicket(actor: JwtPayload, ticket: TicketVisibilityFields): boolean {
  if (actor.restrictToOwnTickets && ticket.assignedTo !== actor.sub && ticket.createdBy !== actor.sub) {
    return false;
  }
  if (actor.restrictToDepartments && (!ticket.teamId || !(actor.departmentIds ?? []).includes(ticket.teamId))) {
    return false;
  }
  return true;
}

export interface StaffRestrictions {
  restrictDepartmentIds?: string[];
  restrictToUserId?: string;
}

// SQL-side twin of staffCanSeeTicket, for any query that filters/aggregates
// across many tickets instead of checking one by id — ticket-service's list
// query and analytics-service's reports both apply this same shape. An empty
// restrictDepartmentIds array is deliberate: "restricted, but zero grants",
// which must match nothing, not "unrestricted".
export function computeStaffRestrictions(actor: JwtPayload): StaffRestrictions {
  return {
    restrictDepartmentIds: actor.restrictToDepartments ? (actor.departmentIds ?? []) : undefined,
    restrictToUserId: actor.restrictToOwnTickets ? actor.sub : undefined,
  };
}
