import { ChatGateway } from '../chat/chat.gateway.js';
import { TicketEventsSubscriberService } from './ticket-events-subscriber.service.js';

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({ on: jest.fn(), subscribe: jest.fn(), disconnect: jest.fn() })),
}));

function callHandleMessage(service: TicketEventsSubscriberService, payload: unknown): void {
  (service as unknown as { handleMessage: (raw: string) => void }).handleMessage(JSON.stringify(payload));
}

// Regression coverage for the ticket-metadata broadcast leak: 'created'/
// 'updated'/'attachment' events used to go straight to
// ChatGateway.broadcastToOperators, reaching every connected operator/admin
// socket regardless of restrictToDepartments/restrictToOwnTickets — the
// same confidentiality gap already fixed for internal chat messages
// (emitToStaffWhoCanSeeTicket), just on this sibling channel.
describe('TicketEventsSubscriberService — staff-wide event scoping', () => {
  let chatGateway: jest.Mocked<Pick<ChatGateway, 'broadcastToUser' | 'emitToStaffWhoCanSeeTicket'>>;
  let service: TicketEventsSubscriberService;

  beforeEach(() => {
    chatGateway = {
      broadcastToUser: jest.fn(),
      emitToStaffWhoCanSeeTicket: jest.fn().mockResolvedValue(undefined),
    };
    service = new TicketEventsSubscriberService(
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as never,
      chatGateway as unknown as ChatGateway,
    );
  });

  it('routes a targeted event straight to that user, never through the staff-wide fan-out', () => {
    callHandleMessage(service, {
      type: 'assigned',
      ticketId: 't-1',
      ticketNumber: 1,
      title: 'Test',
      createdBy: 'client-1',
      targetUserId: 'operator-1',
    });
    expect(chatGateway.broadcastToUser).toHaveBeenCalledWith('operator-1', 'ticket:notification', expect.any(Object));
    expect(chatGateway.emitToStaffWhoCanSeeTicket).not.toHaveBeenCalled();
  });

  it('routes a shared (non-targeted) event through the per-socket scope check, not a raw room broadcast', () => {
    const payload = {
      type: 'updated',
      ticketId: 't-1',
      ticketNumber: 1,
      title: 'Test',
      createdBy: 'client-1',
      assignedTo: 'operator-2',
      teamId: 'team-1',
      excludeUserId: 'actor-1',
    };
    callHandleMessage(service, payload);
    expect(chatGateway.emitToStaffWhoCanSeeTicket).toHaveBeenCalledWith(
      { createdBy: 'client-1', assignedTo: 'operator-2', teamId: 'team-1' },
      'ticket:notification',
      expect.objectContaining(payload),
      'actor-1',
    );
    expect(chatGateway.broadcastToUser).not.toHaveBeenCalled();
  });

  it('does not throw when the fan-out itself rejects (fire-and-forget from a raw ioredis listener)', () => {
    chatGateway.emitToStaffWhoCanSeeTicket.mockRejectedValue(new Error('fetchSockets failed'));
    expect(() =>
      callHandleMessage(service, { type: 'updated', ticketId: 't-1', ticketNumber: 1, title: 'Test', createdBy: 'client-1' }),
    ).not.toThrow();
  });

  it('ignores a malformed message instead of throwing', () => {
    expect(() => (service as unknown as { handleMessage: (raw: string) => void }).handleMessage('not json')).not.toThrow();
    expect(chatGateway.emitToStaffWhoCanSeeTicket).not.toHaveBeenCalled();
    expect(chatGateway.broadcastToUser).not.toHaveBeenCalled();
  });
});
