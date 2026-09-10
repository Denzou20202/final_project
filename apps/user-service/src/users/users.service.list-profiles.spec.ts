import { UserRole } from '@veloxdesk/types';
import { decodeNameCursor, encodeNameCursor } from './name-cursor.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

function makeUser(id: string, fullName: string) {
  return { id, fullName, role: UserRole.CLIENT, permissionGroupId: null, createdAt: new Date() };
}

// Regression coverage for two related scale bugs, both from the round-5
// audit (2026-08-26): GET /users originally had no search param at all, so
// any client picker (ReportFiltersForm's client filter) could only ever
// offer whichever ~100 accounts landed on the first createdAt-ordered page.
// `search` switches findPage into a name/email ILIKE lookup instead. That
// fixed the picker, but left the admin Users table (UsersPage.tsx) itself
// still hard-capped at one page — search results couldn't be paged past
// `limit` either, since search mode dropped any incoming cursor entirely.
// `search`+cursor now keyset-paginates by (fullName, id) via NameCursor,
// mirroring what the createdAt path already did.
describe('UsersService.listPublicProfiles — search mode', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findPage'>>;
  let permissionGroupsRepository: { findFlagsByGroupIds: jest.Mock };
  let teamsService: { getTeamIdsForUsers: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    usersRepository = { findPage: jest.fn().mockResolvedValue([]) };
    permissionGroupsRepository = { findFlagsByGroupIds: jest.fn().mockResolvedValue(new Map()) };
    teamsService = { getTeamIdsForUsers: jest.fn().mockResolvedValue(new Map()) };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      permissionGroupsRepository as never,
      {} as never,
      teamsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('passes the search term through to findPage with no searchAfter when no cursor is given', async () => {
    usersRepository.findPage.mockResolvedValue([makeUser('u1', 'Иван Иванов')] as never);

    const result = await service.listPublicProfiles(20, undefined, 'иван');

    expect(usersRepository.findPage).toHaveBeenCalledWith(20, undefined, 'иван', undefined);
    expect(result.items).toHaveLength(1);
  });

  it('decodes an incoming cursor as a NameCursor (not the createdAt KeysetCursor) when search is active', async () => {
    const cursor = encodeNameCursor({ fullName: 'Иван Иванов', id: 'u1' });

    await service.listPublicProfiles(20, cursor, 'иван');

    expect(usersRepository.findPage).toHaveBeenCalledWith(20, undefined, 'иван', { fullName: 'Иван Иванов', id: 'u1' });
  });

  it('rejects a cursor from the other pagination mode (or any other malformed value) with a 400, not a silent drop', async () => {
    await expect(service.listPublicProfiles(20, 'not-a-name-cursor', 'иван')).rejects.toThrow('Invalid pagination cursor');
    expect(usersRepository.findPage).not.toHaveBeenCalled();
  });

  it('trims to `limit` and encodes a NameCursor (not a createdAt cursor) for the next page when a full page+1 comes back', async () => {
    usersRepository.findPage.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => makeUser(`u${i}`, `User ${String(i).padStart(2, '0')}`)) as never,
    );

    const result = await service.listPublicProfiles(20, undefined, 'user');

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    expect(decodeNameCursor(result.nextCursor as string)).toEqual({ fullName: 'User 19', id: 'u19' });
  });

  it('returns a null nextCursor once the search results fit in a single page', async () => {
    usersRepository.findPage.mockResolvedValue([makeUser('u1', 'Иван Иванов')] as never);

    const result = await service.listPublicProfiles(20, undefined, 'иван');

    expect(result.nextCursor).toBeNull();
  });
});
