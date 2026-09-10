import { JwtPayload } from '@veloxdesk/common';
import { TicketStatus, UserRole } from '@veloxdesk/types';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity-shaped fixture — only the fields
// toPublicTicketStatus (called by broadcastTicketUpdated) actually reads.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    ticketNumber: 42,
    title: 'Тест',
    createdBy: 'client-1',
    status: OPEN_STATUS,
    teamId: null,
    assignedTo: null,
    deletedAt: new Date(),
    ...overrides,
  };
}

function makeActor(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'admin-1', email: 'admin@veloxdesk.local', role: UserRole.ADMIN, ...overrides };
}

describe('TicketsService.hardDelete', () => {
  let ticketsRepository: { findByIdIncludingDeleted: jest.Mock; hardDelete: jest.Mock; hasMention: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let attachmentsRepository: { find: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let s3Service: { deleteObject: jest.Mock };
  let service: TicketsService;

  function build(ticket: ReturnType<typeof makeTicket>, attachments: { fileUrl: string }[]) {
    ticketsRepository = {
      findByIdIncludingDeleted: jest.fn().mockResolvedValue(ticket),
      hardDelete: jest.fn(),
      hasMention: jest.fn().mockResolvedValue(false),
    };
    searchIndexProducer = { enqueueTicket: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    attachmentsRepository = { find: jest.fn().mockResolvedValue(attachments) };
    dataSource = { getRepository: jest.fn().mockReturnValue(attachmentsRepository) };
    s3Service = { deleteObject: jest.fn().mockResolvedValue(undefined) };

    service = new TicketsService(
      ticketsRepository as never,
      {} as never,
      {} as never,
      ticketEventsPublisher as never,
      searchIndexProducer as never,
      {} as never,
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      s3Service as never,
    );
  }

  it('deletes the ticket row, then every attachment object in S3', async () => {
    build(makeTicket(), [{ fileUrl: 'ticket-1/a.png' }, { fileUrl: 'ticket-1/b.png' }]);

    await service.hardDelete('ticket-1', makeActor());

    expect(attachmentsRepository.find).toHaveBeenCalledWith({ where: { ticketId: 'ticket-1' }, select: ['fileUrl'] });
    expect(ticketsRepository.hardDelete).toHaveBeenCalledWith('ticket-1');
    // Attachment keys must be read before the DB delete, since the row's
    // cascade would otherwise remove them first.
    expect(attachmentsRepository.find.mock.invocationCallOrder[0]).toBeLessThan(
      ticketsRepository.hardDelete.mock.invocationCallOrder[0],
    );
    expect(s3Service.deleteObject).toHaveBeenCalledWith('ticket-1/a.png');
    expect(s3Service.deleteObject).toHaveBeenCalledWith('ticket-1/b.png');
    expect(searchIndexProducer.enqueueTicket).toHaveBeenCalledWith('ticket-1');
    // Regression: hardDelete used to be one of three ticket mutations (with
    // remove/restore) that never called broadcastTicketUpdated at all — a
    // client with the ticket still open, or another operator's list, had no
    // way to learn it was gone short of a manual refresh.
    expect(ticketEventsPublisher.publish).toHaveBeenCalledTimes(2);
  });

  it('does not call S3 at all when the ticket has no attachments', async () => {
    build(makeTicket(), []);

    await service.hardDelete('ticket-1', makeActor());

    expect(ticketsRepository.hardDelete).toHaveBeenCalledWith('ticket-1');
    expect(s3Service.deleteObject).not.toHaveBeenCalled();
  });

  it('still removes the ticket from the DB even if an S3 object delete fails', async () => {
    build(makeTicket(), [{ fileUrl: 'ticket-1/a.png' }]);
    s3Service.deleteObject.mockRejectedValueOnce(new Error('bucket unreachable'));

    await expect(service.hardDelete('ticket-1', makeActor())).resolves.toBeUndefined();

    expect(ticketsRepository.hardDelete).toHaveBeenCalledWith('ticket-1');
  });

  it('refuses to hard-delete a ticket that is not in Trash', async () => {
    build(makeTicket({ deletedAt: null }), []);

    await expect(service.hardDelete('ticket-1', makeActor())).rejects.toThrow('Ticket not found in trash');
    expect(ticketsRepository.hardDelete).not.toHaveBeenCalled();
  });
});
