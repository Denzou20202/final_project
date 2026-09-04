import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

function makeQueryFailedError(code: string): QueryFailedError {
  const error = new QueryFailedError('DELETE FROM users WHERE id = $1', [], new Error('fk violation'));
  (error as unknown as { code: string }).code = code;
  return error;
}

// Regression coverage: reject()'s hard delete has no defensive FK handling
// (unlike UsersService.hardDelete, which reassigns blocking FKs before
// deleting) — an email-provisioned pending account (see
// EmailUserResolverService.findOrCreateByEmail) can already have real
// tickets/comments attached despite never completing approval, so a raw
// Postgres foreign_key_violation was previously surfacing as an unhandled
// 500 instead of a clean 409.
describe('UsersService.reject — foreign key violation handling', () => {
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById' | 'hardDeleteIfPending'>>;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'u1', approvedAt: null }),
      hardDeleteIfPending: jest.fn(),
    };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
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

  it('translates a foreign_key_violation into a clean 409 instead of letting it propagate raw', async () => {
    usersRepository.hardDeleteIfPending.mockRejectedValue(makeQueryFailedError('23503'));

    await expect(service.reject('u1')).rejects.toThrow(ConflictException);
  });

  it('re-throws any other error unchanged', async () => {
    const other = new Error('connection reset');
    usersRepository.hardDeleteIfPending.mockRejectedValue(other);

    await expect(service.reject('u1')).rejects.toBe(other);
  });

  it('still rejects cleanly when there is truly nothing to delete', async () => {
    usersRepository.hardDeleteIfPending.mockResolvedValue(false);

    await expect(service.reject('u1')).rejects.toThrow(ConflictException);
  });
});
