import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CompaniesService } from './companies.service.js';

function makeUniqueViolation(): QueryFailedError {
  return Object.assign(new QueryFailedError('INSERT ...', [], new Error('duplicate key')), { code: '23505' });
}

// Regression coverage for the concurrent-create/rename race: the
// findByName pre-check is only a friendly early error — two concurrent
// requests for the same name can both pass it, and only the DB's real
// UNIQUE constraint stops the second one. Without translating that into a
// ConflictException, the loser used to surface as a raw, unhandled 500.
describe('CompaniesService — concurrent-create/rename race', () => {
  let repository: { findByName: jest.Mock; create: jest.Mock; updateName: jest.Mock; findById: jest.Mock };
  let service: CompaniesService;

  beforeEach(() => {
    repository = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      updateName: jest.fn(),
      findById: jest.fn(),
    };
    service = new CompaniesService(repository as never);
  });

  it('translates a unique-violation on create into a ConflictException', async () => {
    repository.create.mockRejectedValue(makeUniqueViolation());

    await expect(service.create('Acme')).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates a unique-violation on rename into a ConflictException', async () => {
    repository.findById.mockResolvedValue({ id: 'c1', name: 'Old' });
    repository.updateName.mockRejectedValue(makeUniqueViolation());

    await expect(service.rename('c1', 'Acme')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows an unrelated error unchanged', async () => {
    const other = new Error('connection reset');
    repository.create.mockRejectedValue(other);

    await expect(service.create('Acme')).rejects.toBe(other);
  });
});
