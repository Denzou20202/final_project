import { TicketPriority, TicketStatus, TicketType } from '@veloxdesk/types';
import { NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity/TicketTypeEntity-shaped fixtures — only the
// fields the code paths under test actually read.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const SERVICE_REQUEST_TYPE = { id: 'type-service-request', key: TicketType.SERVICE_REQUEST, name: 'Запрос на обслуживание', color: '#4C82F7', isDefault: true, weight: 1, sortOrder: 2 };

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    ticketNumber: 42,
    title: 'Тест',
    description: '',
    statusId: OPEN_STATUS.id,
    status: OPEN_STATUS,
    priority: TicketPriority.MEDIUM,
    typeId: SERVICE_REQUEST_TYPE.id,
    type: SERVICE_REQUEST_TYPE,
    createdBy: 'client-1',
    assignedTo: 'operator-1',
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TicketsService.notifyAttachmentAdded', () => {
  let ticketsRepository: { findById: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let service: TicketsService;

  beforeEach(() => {
    ticketsRepository = { findById: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn() };

    service = new TicketsService(
      ticketsRepository as never,
      {} as never,
      {} as never,
      ticketEventsPublisher as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('publishes an attachment event to both the ticket owner and operators', async () => {
    ticketsRepository.findById.mockResolvedValue(makeTicket());

    await service.notifyAttachmentAdded('ticket-1', 'operator-1');

    // Two independent publishes (see broadcastTicketUpdated's own comment) —
    // one routed to the client's own room, one to the operators room.
    expect(ticketEventsPublisher.publish).toHaveBeenCalledTimes(2);
    expect(ticketEventsPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'attachment', ticketId: 'ticket-1', targetUserId: 'client-1' }),
    );
    expect(ticketEventsPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'attachment', ticketId: 'ticket-1', excludeUserId: 'operator-1' }),
    );
  });

  it('throws for a nonexistent ticket instead of publishing anything', async () => {
    ticketsRepository.findById.mockResolvedValue(null);

    await expect(service.notifyAttachmentAdded('missing', 'operator-1')).rejects.toThrow(NotFoundException);
    expect(ticketEventsPublisher.publish).not.toHaveBeenCalled();
  });
});
