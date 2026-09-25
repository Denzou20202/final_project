import { TicketsService } from './tickets.service.js';
import { UserRole } from '@veloxdesk/types';

describe('TicketsService.edit sanitization', () => {
  let ticketsRepository: { findById: jest.Mock };
  let activityRepository: { log: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  let manager: { update: jest.Mock; insert: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: TicketsService;

  const mockTicket = {
    id: 'ticket-1',
    ticketNumber: 101,
    title: 'Original title',
    description: 'Original description',
    statusId: 'status-1',
    typeId: 'type-1',
    createdBy: 'user-1',
    assignedTo: null,
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: { id: 'status-1', name: 'Open', color: '#fff', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 },
    type: { id: 'type-1', name: 'Question', color: '#fff', isDefault: true, weight: 1, sortOrder: 1 },
  };

  beforeEach(() => {
    ticketsRepository = {
      findById: jest.fn().mockResolvedValue(mockTicket),
    };
    activityRepository = { log: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    searchIndexProducer = { enqueueTicket: jest.fn().mockResolvedValue(undefined) };
    manager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({ identifiers: [{}] }),
    };
    dataSource = { transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) => cb(manager)) };

    service = new TicketsService(
      ticketsRepository as never,
      activityRepository as never,
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
      {} as never,
    );
  });

  it('sanitizes malicious script tags and unsafe HTML in description during update', async () => {
    const actor = { sub: 'user-1', email: 'user@example.com', role: UserRole.CLIENT };
    let capturedUpdateData: Record<string, unknown> | undefined;

    manager.update.mockImplementation((_entity: unknown, _criteria: unknown, data: Record<string, unknown>) => {
      capturedUpdateData = data;
      return Promise.resolve({ affected: 1 });
    });

    await service.update(
      'ticket-1',
      {
        description: '<p>Safe text</p><script>alert("xss")</script><style>body { color: red; }</style>',
      },
      actor,
    );

    expect(capturedUpdateData).toBeDefined();
    expect(capturedUpdateData?.description).not.toContain('<script>');
    expect(capturedUpdateData?.description).not.toContain('<style>');
    expect(capturedUpdateData?.description).toContain('<p>Safe text</p>');
  });
});
