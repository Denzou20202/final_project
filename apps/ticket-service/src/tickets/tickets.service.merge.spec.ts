import { JwtPayload } from '@veloxdesk/common';
import { TicketCustomFieldValueEntity, TicketMentionEntity, TicketTagEntity, TicketWatcherEntity } from '@veloxdesk/database';
import { TicketPriority, TicketType, TicketStatus, UserRole } from '@veloxdesk/types';
import { BadRequestException } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity/TicketTypeEntity-shaped fixtures — only the
// fields the code paths under test actually read.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const CLOSED_STATUS = { id: 'status-closed', key: TicketStatus.CLOSED, name: 'Завершено', color: '#C7BDAF', isDefault: false, isClosed: true, tracksSla: false, sortOrder: 4 };
const SERVICE_REQUEST_TYPE = { id: 'type-service-request', key: TicketType.SERVICE_REQUEST, name: 'Запрос на обслуживание', color: '#4C82F7', isDefault: true, weight: 1, sortOrder: 2 };

function makeTicket(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ticketNumber: id === 'source-1' ? 1 : 2,
    title: 'Тест',
    description: '',
    statusId: OPEN_STATUS.id,
    status: OPEN_STATUS,
    priority: TicketPriority.MEDIUM,
    typeId: SERVICE_REQUEST_TYPE.id,
    type: SERVICE_REQUEST_TYPE,
    createdBy: 'client-1',
    assignedTo: null,
    mergedIntoId: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeActor(): JwtPayload {
  return { sub: 'admin-1', email: 'admin@veloxdesk.local', role: UserRole.ADMIN };
}

describe('TicketsService.merge — concurrent merge guard', () => {
  let ticketsRepository: { findById: jest.Mock };
  let managerUpdate: jest.Mock;
  let managerCreateQueryBuilder: jest.Mock;
  let qbFrom: jest.Mock;
  let qbExecute: jest.Mock;
  let qbGetOne: jest.Mock;
  let dataSource: { transaction: jest.Mock };
  let activityRepository: { log: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let ticketStatusesRepository: { findClosedForSystemActions: jest.Mock };
  let service: TicketsService;

  beforeEach(() => {
    const tickets: Record<string, ReturnType<typeof makeTicket>> = {
      'source-1': makeTicket('source-1'),
      'target-1': makeTicket('target-1'),
    };
    ticketsRepository = { findById: jest.fn((id: string) => Promise.resolve(tickets[id] ?? null)) };
    managerUpdate = jest.fn();
    qbFrom = jest.fn().mockReturnThis();
    qbExecute = jest.fn().mockResolvedValue({});
    // Locking re-check of the target (setLock/getOne) shares the same
    // builder chain as the conflict-clearing deletes below — defaults to
    // "target not merged", the happy-path case, overridden per-test.
    qbGetOne = jest.fn().mockResolvedValue(makeTicket('target-1'));
    managerCreateQueryBuilder = jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      from: qbFrom,
      where: jest.fn().mockReturnThis(),
      execute: qbExecute,
      setLock: jest.fn().mockReturnThis(),
      getOne: qbGetOne,
    });
    dataSource = {
      transaction: jest.fn((cb) => cb({ update: managerUpdate, createQueryBuilder: managerCreateQueryBuilder })),
    };
    activityRepository = { log: jest.fn() };
    searchIndexProducer = { enqueueTicket: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn() };
    ticketStatusesRepository = { findClosedForSystemActions: jest.fn().mockResolvedValue(CLOSED_STATUS) };

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
      ticketStatusesRepository as never,
      {} as never,
      {} as never,
    );
  });

  it('rejects when the source was merged by a concurrent call between the pre-check and the transaction', async () => {
    // The guarded TicketEntity update (first manager.update call) reports no
    // rows matched — someone else's merge() already set mergedIntoId.
    managerUpdate.mockResolvedValueOnce({ affected: 0 });

    await expect(
      service.merge('source-1', { targetTicketId: 'target-1' }, makeActor()),
    ).rejects.toThrow(BadRequestException);

    // The locking target re-check runs first (harmless — a SELECT, not a
    // write), then nothing else must move once the guarded status update
    // itself loses the race.
    expect(managerUpdate).toHaveBeenCalledTimes(1);
    expect(managerCreateQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qbExecute).not.toHaveBeenCalled();
  });

  it('rejects when the target was merged elsewhere by a concurrent call, even though the pre-check outside the transaction passed', async () => {
    // Simulates the same race the source-side guard above already covers,
    // mirrored onto the target: by the time this transaction's locking
    // SELECT actually runs, some other merge() has already set the
    // target's own mergedIntoId (its FOR UPDATE lock would have made this
    // call block until that other transaction committed, in real Postgres).
    qbGetOne.mockResolvedValueOnce(makeTicket('target-1', { mergedIntoId: 'other-ticket' }));

    await expect(
      service.merge('source-1', { targetTicketId: 'target-1' }, makeActor()),
    ).rejects.toThrow(BadRequestException);

    // Nothing must move if the target turned out to already be merged away.
    expect(managerUpdate).not.toHaveBeenCalled();
  });

  it('moves comments, attachments, tags, custom field values, and watchers once the guarded update succeeds', async () => {
    managerUpdate.mockResolvedValue({ affected: 1 });

    await service.merge('source-1', { targetTicketId: 'target-1' }, makeActor());

    // Status guard + comments + attachments + tag repoint + custom-field
    // repoint + watcher repoint + mention repoint.
    expect(managerUpdate).toHaveBeenCalledTimes(7);
    expect(managerUpdate).toHaveBeenCalledWith(TicketTagEntity, { ticketId: 'source-1' }, { ticketId: 'target-1' });
    expect(managerUpdate).toHaveBeenCalledWith(
      TicketCustomFieldValueEntity,
      { ticketId: 'source-1' },
      { ticketId: 'target-1' },
    );
    expect(managerUpdate).toHaveBeenCalledWith(
      TicketWatcherEntity,
      { ticketId: 'source-1' },
      { ticketId: 'target-1' },
    );
    // Regression: mentions used to be the one relation merge() left behind
    // on the source ticket — a department-restricted operator's access
    // (staffCanSeeTicket's mention bypass) and the "Упоминания" folder both
    // read off this table, so a stranded mention silently cut off exactly
    // the access someone was pulled in for.
    expect(managerUpdate).toHaveBeenCalledWith(
      TicketMentionEntity,
      { ticketId: 'source-1' },
      { ticketId: 'target-1' },
    );

    // Locking target re-check, then a conflict-clearing delete once each for
    // tags, custom field values, watchers, and mentions, BEFORE the repoint
    // above — a tag/field/watcher/mention shared between source and target
    // must not hit the UNIQUE(ticket_id, tag_id/field_id/user_id) constraint.
    expect(managerCreateQueryBuilder).toHaveBeenCalledTimes(5);
    expect(qbFrom).toHaveBeenCalledWith(TicketTagEntity);
    expect(qbFrom).toHaveBeenCalledWith(TicketCustomFieldValueEntity);
    expect(qbFrom).toHaveBeenCalledWith(TicketWatcherEntity);
    expect(qbFrom).toHaveBeenCalledWith(TicketMentionEntity);
    expect(qbExecute).toHaveBeenCalledTimes(4);

    expect(searchIndexProducer.enqueueTicket).toHaveBeenCalledWith('source-1');
    expect(searchIndexProducer.enqueueTicket).toHaveBeenCalledWith('target-1');
  });
});
