import { JwtPayload } from '@veloxdesk/common';
import { TicketPriority, UserRole } from '@veloxdesk/types';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { SlaPoliciesService } from './sla-policies.service.js';

function makeUniqueViolation(): QueryFailedError {
  return Object.assign(new QueryFailedError('INSERT ...', [], new Error('duplicate key')), { code: '23505' });
}

const actor: JwtPayload = { sub: 'admin-1', email: 'admin@veloxdesk.local', role: UserRole.ADMIN };

describe('SlaPoliciesService — concurrent-create race', () => {
  let repository: { findByPriority: jest.Mock; create: jest.Mock; update: jest.Mock; findById: jest.Mock };
  let settingsAuditLog: { log: jest.Mock };
  let service: SlaPoliciesService;

  beforeEach(() => {
    repository = {
      findByPriority: jest.fn().mockResolvedValue(null), // pre-check sees no existing row
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    };
    settingsAuditLog = { log: jest.fn() };
    service = new SlaPoliciesService(repository as never, settingsAuditLog as never);
  });

  const dto = { name: 'Срочные', priority: TicketPriority.URGENT, responseTimeMin: 15, resolutionTimeMin: 60 };

  it('translates a unique-constraint violation from a concurrent create into a clean 409', async () => {
    // Pre-check passed (no row yet), but the INSERT itself lost the race to
    // a second concurrent create() for the same priority.
    repository.create.mockRejectedValue(makeUniqueViolation());

    await expect(service.create(dto, actor)).rejects.toThrow(ConflictException);
  });

  it('still creates normally when there is no race', async () => {
    repository.create.mockResolvedValue({ id: 'policy-1', ...dto });

    await expect(service.create(dto, actor)).resolves.toMatchObject({ priority: TicketPriority.URGENT });
  });

  it('translates a unique-constraint violation on update the same way', async () => {
    repository.findById.mockResolvedValue({ id: 'policy-1', ...dto, priority: TicketPriority.HIGH });
    repository.update.mockRejectedValue(makeUniqueViolation());

    await expect(service.update('policy-1', { priority: TicketPriority.URGENT }, actor)).rejects.toThrow(
      ConflictException,
    );
  });
});
