import { UserRole } from '@veloxdesk/types';
import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ContactsService } from './contacts.service.js';
import { MergeContactsDto } from './dto/merge-contacts.dto.js';

function makeContact(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'contact-1',
    email: 'client@example.com',
    fullName: 'Иван Иванов',
    role: UserRole.CLIENT,
    phone: null,
    company: null,
    department: null,
    position: null,
    computerName: null,
    city: null,
    locale: 'ru',
    permissionGroupId: null,
    twoFactorEnabled: false,
    currentStatusId: null,
    mergedIntoId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    ...overrides,
  };
}

describe('ContactsService.findDuplicateGroups', () => {
  let usersRepository: jest.Mocked<Pick<Repository<never>, 'find'>>;
  let service: ContactsService;

  beforeEach(() => {
    usersRepository = { find: jest.fn() };
    service = new ContactsService(usersRepository as never, {} as unknown as DataSource);
  });

  it('returns nothing when there are fewer than two contacts', async () => {
    usersRepository.find.mockResolvedValue([makeContact()] as never);
    expect(await service.findDuplicateGroups()).toEqual([]);
  });

  it('groups two contacts sharing the same email (case/whitespace-insensitive)', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'a', email: '  Client@Example.com ', fullName: 'Один' }),
      makeContact({ id: 'b', email: 'client@example.com', fullName: 'Другой' }),
    ] as never);
    const groups = await service.findDuplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].matchedOn).toEqual(['email']);
    expect(groups[0].contacts.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('groups two contacts sharing the same phone once punctuation is stripped', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'a', email: 'a@example.com', fullName: 'Первый', phone: '+380 (44) 123-45-67' }),
      makeContact({ id: 'b', email: 'b@example.com', fullName: 'Второй', phone: '380441234567' }),
    ] as never);
    const groups = await service.findDuplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].matchedOn).toEqual(['phone']);
  });

  it('does not flag short/blank phone placeholders as a match', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'a', email: 'a@example.com', fullName: 'Первый', phone: '-' }),
      makeContact({ id: 'b', email: 'b@example.com', fullName: 'Второй', phone: '-' }),
    ] as never);
    expect(await service.findDuplicateGroups()).toEqual([]);
  });

  it('chains an indirect match into one group (A~B by email, B~C by phone)', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'a', fullName: 'Первый', email: 'shared@example.com', phone: '111111111' }),
      makeContact({ id: 'b', fullName: 'Второй', email: 'shared@example.com', phone: '222222222' }),
      makeContact({ id: 'c', fullName: 'Третий', email: 'c@example.com', phone: '222222222' }),
    ] as never);
    const groups = await service.findDuplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].contacts.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
    expect(groups[0].matchedOn.sort()).toEqual(['email', 'phone']);
  });

  it('does not group two unrelated contacts', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'a', email: 'a@example.com', fullName: 'Первый Клиент' }),
      makeContact({ id: 'b', email: 'b@example.com', fullName: 'Второй Клиент' }),
    ] as never);
    expect(await service.findDuplicateGroups()).toEqual([]);
  });
});

describe('ContactsService.merge', () => {
  let usersRepository: jest.Mocked<Pick<Repository<never>, 'find' | 'findOneOrFail'>>;
  let manager: {
    update: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let service: ContactsService;

  const dto: MergeContactsDto = { primaryId: 'primary', duplicateIds: ['loser-1'] };

  let getPrimaryLockRow: jest.Mock;

  beforeEach(() => {
    usersRepository = { find: jest.fn(), findOneOrFail: jest.fn() };
    // Primary-lock check (withDeleted/setLock/where/getOne) resolves a live,
    // unmerged primary by default — overridden per-test to simulate the
    // concurrent-merge race.
    getPrimaryLockRow = jest.fn().mockResolvedValue({ id: 'primary', mergedIntoId: null });
    manager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      softDelete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
        withDeleted: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: getPrimaryLockRow,
      }),
    };
    dataSource = { transaction: jest.fn((cb) => cb(manager)) as never };
    service = new ContactsService(usersRepository as never, dataSource as unknown as DataSource);
  });

  it('rejects merging a contact into itself', async () => {
    await expect(service.merge({ primaryId: 'x', duplicateIds: ['x'] })).rejects.toThrow(BadRequestException);
  });

  it('rejects when a referenced contact is missing, non-client, or already merged', async () => {
    usersRepository.find.mockResolvedValue([makeContact({ id: 'primary' })] as never); // loser-1 missing
    await expect(service.merge(dto)).rejects.toThrow(BadRequestException);
  });

  it('repoints every FK table and soft-deletes the loser on a happy path', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'primary' }),
      makeContact({ id: 'loser-1' }),
    ] as never);
    usersRepository.findOneOrFail.mockResolvedValue(makeContact({ id: 'primary' }) as never);

    const result = await service.merge(dto);

    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { createdBy: 'loser-1' }, { createdBy: 'primary' });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { createdOnBehalfBy: 'loser-1' },
      { createdOnBehalfBy: 'primary' },
    );
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { authorId: 'loser-1' }, { authorId: 'primary' });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { uploaderId: 'loser-1' }, { uploaderId: 'primary' });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { actorId: 'loser-1' }, { actorId: 'primary' });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { userId: 'loser-1' }, { userId: 'primary' });
    expect(manager.softDelete).toHaveBeenCalledWith(expect.anything(), 'loser-1');
    expect(result.id).toBe('primary');
  });

  it('throws if the loser was concurrently merged elsewhere first (affected === 0)', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'primary' }),
      makeContact({ id: 'loser-1' }),
    ] as never);
    manager.update.mockImplementation((entity, where) =>
      Promise.resolve(typeof where === 'object' && 'mergedIntoId' in where ? { affected: 0 } : { affected: 1 }),
    );

    await expect(service.merge(dto)).rejects.toThrow(BadRequestException);
    expect(manager.softDelete).not.toHaveBeenCalled();
  });

  // Regression test for the chained-merge race: X merged into Z, Y merged
  // into X, both concurrently — this call's primaryId (X) was merged away
  // by the other transaction between the pre-transaction existence check
  // and this one reaching its own row-lock inside the transaction.
  it('throws if the primary was concurrently merged into someone else first', async () => {
    usersRepository.find.mockResolvedValue([
      makeContact({ id: 'primary' }),
      makeContact({ id: 'loser-1' }),
    ] as never);
    getPrimaryLockRow.mockResolvedValue({ id: 'primary', mergedIntoId: 'someone-else' });

    await expect(service.merge(dto)).rejects.toThrow(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.softDelete).not.toHaveBeenCalled();
  });
});
