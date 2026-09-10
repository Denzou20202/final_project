import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CitiesService } from './cities.service.js';

function makeUniqueViolation(): QueryFailedError {
  return Object.assign(new QueryFailedError('INSERT ...', [], new Error('duplicate key')), { code: '23505' });
}

// See companies.service.spec.ts — same race, same fix shape.
describe('CitiesService — concurrent-create/rename race', () => {
  let repository: { findByName: jest.Mock; create: jest.Mock; updateName: jest.Mock; findById: jest.Mock };
  let service: CitiesService;

  beforeEach(() => {
    repository = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      updateName: jest.fn(),
      findById: jest.fn(),
    };
    service = new CitiesService(repository as never);
  });

  it('translates a unique-violation on create into a ConflictException', async () => {
    repository.create.mockRejectedValue(makeUniqueViolation());

    await expect(service.create('Kyiv')).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates a unique-violation on rename into a ConflictException', async () => {
    repository.findById.mockResolvedValue({ id: 'c1', name: 'Old' });
    repository.updateName.mockRejectedValue(makeUniqueViolation());

    await expect(service.rename('c1', 'Kyiv')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows an unrelated error unchanged', async () => {
    const other = new Error('connection reset');
    repository.create.mockRejectedValue(other);

    await expect(service.create('Kyiv')).rejects.toBe(other);
  });
});
