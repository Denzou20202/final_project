import { UserRole } from '@veloxdesk/types';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

function makeUser(id: string, fullName: string) {
  return { id, fullName, role: UserRole.CLIENT, permissionGroupId: null, createdAt: new Date() };
}

// Regression coverage for the report-filters scale bug: GET /users had no
// search param at all, so any client picker (ReportFiltersForm's client
// filter) could only ever offer whichever ~100 accounts landed on the
// first createdAt-ordered page — the vast majority of a 1000+-client
// deployment was simply unreachable. `search` switches findPage into a
// name/email ILIKE lookup instead.
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

  it('passes the search term through to findPage instead of a cursor', async () => {
    usersRepository.findPage.mockResolvedValue([makeUser('u1', 'Иван Иванов')] as never);

    const result = await service.listPublicProfiles(20, undefined, 'иван');

    expect(usersRepository.findPage).toHaveBeenCalledWith(20, undefined, 'иван');
    expect(result.items).toHaveLength(1);
  });

  it('ignores an incoming cursor when search is active — the orderings are incompatible', async () => {
    await service.listPublicProfiles(20, 'some-opaque-cursor', 'иван');

    expect(usersRepository.findPage).toHaveBeenCalledWith(20, undefined, 'иван');
  });

  it('trims to `limit` and never computes a nextCursor in search mode, even if a full page+1 comes back', async () => {
    usersRepository.findPage.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => makeUser(`u${i}`, `User ${i}`)) as never,
    );

    const result = await service.listPublicProfiles(20, undefined, 'user');

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeNull();
  });
});
