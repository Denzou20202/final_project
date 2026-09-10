import { TicketActivityType, TicketPriority, TicketStatus, UserRole } from './enums.js';

describe('enums', () => {
  it('defines the 4 seeded ticket status keys in order open -> pending -> resolved -> closed', () => {
    expect(Object.values(TicketStatus)).toEqual([
      'open',
      'pending',
      'resolved',
      'closed',
    ]);
  });

  it('defines the three user roles used for access control', () => {
    expect(Object.values(UserRole)).toEqual(['client', 'operator', 'admin']);
  });

  it('defines the four ticket priorities', () => {
    expect(Object.values(TicketPriority)).toEqual(['low', 'medium', 'high', 'urgent']);
  });

  it('defines the ticket activity/audit-log event types', () => {
    expect(Object.values(TicketActivityType)).toEqual([
      'created',
      'status_changed',
      'priority_changed',
      'assigned',
      'unassigned',
      'edited',
      'attachment_added',
      'sla_response_breached',
      'sla_resolution_breached',
      'tag_added',
      'tag_removed',
      'merged_into',
      'merged_from',
      'deleted',
      'restored',
      'status_email_sent',
      'message_edited',
      'csat_submitted',
    ]);
  });
});
