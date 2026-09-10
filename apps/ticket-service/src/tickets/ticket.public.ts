import { TicketActivityEntity, TicketEntity } from '@veloxdesk/database';
import { PublicTicketStatus, PublicTicketType, TicketActivityType, TicketChannel, TicketPriority } from '@veloxdesk/types';
import { toPublicTicketStatus } from '../ticket-statuses/ticket-status.public.js';
import { toPublicTicketType } from '../ticket-types/ticket-type.public.js';

export interface PublicTicket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: PublicTicketStatus;
  priority: TicketPriority;
  type: PublicTicketType;
  channel: TicketChannel;
  createdBy: string;
  createdOnBehalfBy: string | null;
  assignedTo: string | null;
  teamId: string | null;
  categoryId: string | null;
  slaPolicyId: string | null;
  mergedIntoId: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  deletedAt: Date | null;
}

// Creation only — lets the caller link an immediately-following attachment
// upload to the opening message instead of leaving it ticket-scoped (see
// NewTicketPage.tsx). Every other ticket-returning endpoint uses plain
// PublicTicket; this extra field has no meaning once the ticket already
// exists.
export interface PublicCreatedTicket extends PublicTicket {
  descriptionCommentId: string;
}

export interface PublicTicketPage {
  items: PublicTicket[];
  nextCursor: string | null;
}

export interface PublicTicketCounts {
  total: number;
  // Keyed by ticket_statuses.id, not a fixed enum — see PublicTicketStatus.
  byStatus: Record<string, number>;
}

// Backs Sidebar's per-team accordion — same shape as PublicTicketCounts,
// plus the two things it needs to render the «Неприсвоенные» row and the
// operator drill-down: how many of the team's tickets have no assignee
// (regardless of status, same definition the top-level «Неприсвоенные»
// filter uses), and a per-operator breakdown for tickets that do.
export interface PublicTeamTicketCounts extends PublicTicketCounts {
  unassigned: number;
  byAssignee: Record<string, PublicTicketCounts>;
}

export interface PublicTicketActivity {
  id: string;
  actorId: string | null;
  type: TicketActivityType;
  fromValue: string | null;
  toValue: string | null;
  field: string | null;
  createdAt: Date;
}

export function toPublicTicket(ticket: TicketEntity): PublicTicket {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    status: toPublicTicketStatus(ticket.status),
    priority: ticket.priority,
    type: toPublicTicketType(ticket.type),
    channel: ticket.channel,
    createdBy: ticket.createdBy,
    createdOnBehalfBy: ticket.createdOnBehalfBy ?? null,
    assignedTo: ticket.assignedTo ?? null,
    teamId: ticket.teamId ?? null,
    categoryId: ticket.categoryId ?? null,
    slaPolicyId: ticket.slaPolicyId ?? null,
    mergedIntoId: ticket.mergedIntoId ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt ?? null,
    deletedAt: ticket.deletedAt ?? null,
  };
}

export function toPublicActivity(activity: TicketActivityEntity): PublicTicketActivity {
  return {
    id: activity.id,
    actorId: activity.actorId ?? null,
    type: activity.type,
    fromValue: activity.fromValue ?? null,
    toValue: activity.toValue ?? null,
    field: activity.field ?? null,
    createdAt: activity.createdAt,
  };
}
