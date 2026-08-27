import { UserRole } from '@veloxdesk/types';
import { EmailUserResolverService } from './email-user-resolver.service.js';

// Regression coverage: findOrCreateByEmail used to resolve ANY existing
// account by address, staff included — the support mailbox has no way to
// authenticate a From: header (no SPF/DKIM/DMARC check anywhere in this
// app), so putting an admin's real address in From: resolved straight to
// that admin's own UserEntity, letting a forged ticket/reply be attributed
// to them. It also skipped soft-deleted rows entirely (no withDeleted),
// which sent a message from a deactivated account's old address into an
// infinite unique-violation retry loop instead of being rejected cleanly.
describe('EmailUserResolverService.findOrCreateByEmail', () => {
  let usersRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: EmailUserResolverService;

  beforeEach(() => {
    usersRepository = { findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn((v) => Promise.resolve(v)) };
    service = new EmailUserResolverService(usersRepository as never);
  });

  it('returns the existing account for a known client address', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'client-1', role: UserRole.CLIENT, email: 'client@corp.com' });

    const result = await service.findOrCreateByEmail('client@corp.com');

    expect(result).toEqual(expect.objectContaining({ id: 'client-1' }));
    expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { email: 'client@corp.com' }, withDeleted: true });
  });

  it('returns null instead of resolving to a staff account with the same address', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'admin-1', role: UserRole.ADMIN, email: 'admin@corp.com' });

    const result = await service.findOrCreateByEmail('admin@corp.com');

    expect(result).toBeNull();
  });

  it('returns null instead of resolving to a deactivated (soft-deleted) client account', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 'client-1',
      role: UserRole.CLIENT,
      email: 'client@corp.com',
      deletedAt: new Date(),
    });

    const result = await service.findOrCreateByEmail('client@corp.com');

    expect(result).toBeNull();
  });

  it('creates a new, normalized-email client account for a genuinely unknown address', async () => {
    usersRepository.findOne.mockResolvedValue(null);

    const result = await service.findOrCreateByEmail('New.Person@Example.com', 'New Person');

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new.person@example.com', role: UserRole.CLIENT, fullName: 'New Person' }),
    );
    expect(result).toEqual(expect.objectContaining({ email: 'new.person@example.com' }));
  });
});
