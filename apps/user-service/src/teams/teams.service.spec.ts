import { UserRole } from '@veloxdesk/types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamsRepository } from './teams.repository.js';
import { TeamsService } from './teams.service.js';

function makeTeam(overrides: Partial<{ id: string; name: string; createdAt: Date }> = {}) {
  return { id: 'team-1', name: 'Тех поддержка', createdAt: new Date(), ...overrides };
}

function makeUser(id: string, role: UserRole) {
  return { id, role };
}

describe('TeamsService', () => {
  let teamsRepository: jest.Mocked<
    Pick<
      TeamsRepository,
      'create' | 'findAll' | 'findById' | 'updateName' | 'delete' | 'countTicketsForTeam' | 'findMemberIds' | 'findMemberIdsByTeamIds' | 'setMembers' | 'setUserTeam'
    >
  >;
  let usersRepository: { find: jest.Mock; findOne: jest.Mock };
  let service: TeamsService;

  beforeEach(() => {
    teamsRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      updateName: jest.fn(),
      delete: jest.fn(),
      countTicketsForTeam: jest.fn(),
      findMemberIds: jest.fn(),
      findMemberIdsByTeamIds: jest.fn(),
      setMembers: jest.fn(),
      setUserTeam: jest.fn(),
    };
    usersRepository = { find: jest.fn(), findOne: jest.fn() };
    service = new TeamsService(
      teamsRepository as unknown as TeamsRepository,
      usersRepository as never,
    );
  });

  describe('create', () => {
    it('creates a team with no members when memberIds is omitted', async () => {
      teamsRepository.create.mockResolvedValue(makeTeam());

      const result = await service.create({ name: 'Тех поддержка' });

      expect(teamsRepository.setMembers).not.toHaveBeenCalled();
      expect(result.memberIds).toEqual([]);
    });

    it('assigns members after validating they are staff', async () => {
      teamsRepository.create.mockResolvedValue(makeTeam());
      usersRepository.find.mockResolvedValue([makeUser('u1', UserRole.OPERATOR)]);

      const result = await service.create({ name: 'Тех поддержка', memberIds: ['u1'] });

      expect(teamsRepository.setMembers).toHaveBeenCalledWith('team-1', ['u1']);
      expect(result.memberIds).toEqual(['u1']);
    });

    it('rejects a memberId that does not resolve to an operator/admin', async () => {
      teamsRepository.create.mockResolvedValue(makeTeam());
      usersRepository.find.mockResolvedValue([]); // e.g. a client id, or deactivated

      await expect(service.create({ name: 'X', memberIds: ['client-1'] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(teamsRepository.setMembers).not.toHaveBeenCalled();
    });

    it('deduplicates repeated memberIds before validating and assigning', async () => {
      teamsRepository.create.mockResolvedValue(makeTeam());
      usersRepository.find.mockResolvedValue([makeUser('u1', UserRole.OPERATOR)]);

      await service.create({ name: 'X', memberIds: ['u1', 'u1'] });

      expect(usersRepository.find).toHaveBeenCalledWith({
        where: { id: expect.anything(), role: expect.anything() },
      });
      expect(teamsRepository.setMembers).toHaveBeenCalledWith('team-1', ['u1']);
    });
  });

  describe('update', () => {
    it('throws NotFound for a missing team', async () => {
      teamsRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates only the name when memberIds is not provided', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam());
      teamsRepository.findMemberIds.mockResolvedValue(['u1']);

      await service.update('team-1', { name: 'Новое имя' });

      expect(teamsRepository.updateName).toHaveBeenCalledWith('team-1', 'Новое имя', undefined, undefined);
      expect(teamsRepository.setMembers).not.toHaveBeenCalled();
    });

    it('replaces membership with an empty roster when memberIds: []', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam());
      teamsRepository.findMemberIds.mockResolvedValue([]);

      await service.update('team-1', { memberIds: [] });

      expect(teamsRepository.setMembers).toHaveBeenCalledWith('team-1', []);
    });
  });

  // Regression coverage: assignUserTeam used to have no role check at
  // all, unlike create()/update() above — a direct API call (PATCH
  // /users/:id/team) could put a CLIENT into a team.
  describe('assignUserTeam', () => {
    it('always allows clearing membership (teamId: null), no role check needed', async () => {
      await service.assignUserTeam('user-1', null);

      expect(usersRepository.findOne).not.toHaveBeenCalled();
      expect(teamsRepository.setUserTeam).toHaveBeenCalledWith('user-1', null);
    });

    it('assigns an operator to a team', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam());
      usersRepository.findOne.mockResolvedValue(makeUser('user-1', UserRole.OPERATOR));

      await service.assignUserTeam('user-1', 'team-1');

      expect(teamsRepository.setUserTeam).toHaveBeenCalledWith('user-1', 'team-1');
    });

    it('rejects assigning a CLIENT to a team', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam());
      usersRepository.findOne.mockResolvedValue(makeUser('client-1', UserRole.CLIENT));

      await expect(service.assignUserTeam('client-1', 'team-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(teamsRepository.setUserTeam).not.toHaveBeenCalled();
    });

    it('rejects assigning a nonexistent user to a team', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam());
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.assignUserTeam('missing', 'team-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(teamsRepository.setUserTeam).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a team with no referencing tickets', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam());
      teamsRepository.countTicketsForTeam.mockResolvedValue(0);

      await service.remove('team-1');

      expect(teamsRepository.delete).toHaveBeenCalledWith('team-1');
    });

    it('refuses to delete a team that still has tickets, with a message naming it', async () => {
      teamsRepository.findById.mockResolvedValue(makeTeam({ name: 'Продажи' }));
      teamsRepository.countTicketsForTeam.mockResolvedValue(3);

      await expect(service.remove('team-1')).rejects.toThrow(/Продажи/);
      expect(teamsRepository.delete).not.toHaveBeenCalled();
    });
  });
});
