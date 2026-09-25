import { KeysetCursor } from '@veloxdesk/common';
import { UserEntity } from '@veloxdesk/database';
import { AuthProvider, Locale, UserRole } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NameCursor } from './name-cursor.js';

export interface UpdateUserProfileData {
  fullName?: string;
  computerName?: string | null;
  position?: string | null;
  department?: string | null;
  company?: string | null;
  companyId?: string | null;
  city?: string | null;
  cityId?: string | null;
  phone?: string | null;
  locale?: Locale;
  profileCompletedAt?: Date;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  // `deleted_at` doubles as "deactivated" (see UsersService.deactivate) —
  // TypeORM's @DeleteDateColumn auto-excludes soft-deleted rows from a plain
  // find, which is exactly the right default here: login/refresh/assignee
  // lookups should treat a deactivated account as gone. Only the admin
  // management list (findPage) and reactivate() need to see past it.
  findByEmail(email: string, options: { withDeleted?: boolean } = {}): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { email },
      withDeleted: options.withDeleted,
      relations: { companyEntity: true, cityEntity: true },
    });
  }

  findById(id: string, options: { withDeleted?: boolean } = {}): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: options.withDeleted,
      relations: { companyEntity: true, cityEntity: true },
    });
  }

  // Fetches `limit + 1` rows so the caller can tell whether a next page
  // exists without a separate COUNT(*) query. withDeleted: true — the
  // admin Users page must show deactivated accounts too (with a badge),
  // otherwise there'd be no way to find and reactivate one.
  // `search` switches this into a name-ordered ILIKE lookup instead of the
  // usual createdAt-keyset page — see ListUsersQueryDto's own comment for
  // why (both the async-search picker and the paginated admin Users table
  // need to reach any of 1000+ clients, not just whichever ones happen to
  // sort onto the first createdAt page). `searchAfter` keyset-pages through
  // that name-ordered result the same way `after` does for the createdAt
  // order — see NameCursor's own comment for why it's a separate cursor
  // shape instead of reusing `KeysetCursor`.
  findPage(limit: number, after?: KeysetCursor, search?: string, searchAfter?: NameCursor): Promise<UserEntity[]> {
    const qb = this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.companyEntity', 'companyEntity')
      .leftJoinAndSelect('user.cityEntity', 'cityEntity')
      .withDeleted()
      .take(limit + 1);

    if (search) {
      qb.where('(user.fullName ILIKE :search OR user.email ILIKE :search)', { search: `%${search}%` });
      if (searchAfter) {
        qb.andWhere('(user.fullName, user.id) > (:cursorFullName, :cursorId)', {
          cursorFullName: searchAfter.fullName,
          cursorId: searchAfter.id,
        });
      }
      qb.orderBy('user.fullName', 'ASC').addOrderBy('user.id', 'ASC');
      return qb.getMany();
    }

    qb.orderBy('user.createdAt', 'DESC').addOrderBy('user.id', 'DESC');
    if (after) {
      qb.where('(user.createdAt, user.id) < (:createdAt, :id)', {
        createdAt: after.createdAt,
        id: after.id,
      });
    }

    return qb.getMany();
  }

  create(data: {
    email: string;
    // Null only for directory-provisioned accounts (authProvider !== LOCAL)
    // — see UsersService.provisionFromDirectory.
    passwordHash: string | null;
    fullName: string;
    role: UserRole;
    approvedAt: Date | null;
    cannotManageAdmins?: boolean;
    locale?: Locale;
    isVip?: boolean;
    authProvider?: AuthProvider;
    externalId?: string | null;
  }): Promise<UserEntity> {
    const user = this.repository.create(data);
    return this.repository.save(user);
  }

  findByAuthProviderAndExternalId(authProvider: AuthProvider, externalId: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { authProvider, externalId } });
  }

  // Links a pre-existing local account to a directory identity on its first
  // SSO/LDAP login (see UsersService.provisionFromDirectory) — clears the
  // local password per the product decision that a linked account becomes
  // directory-only going forward, not a dual-mode fallback.
  async linkToDirectory(id: string, authProvider: AuthProvider, externalId: string): Promise<void> {
    await this.repository.update({ id }, { authProvider, externalId, passwordHash: null });
  }

  async setRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    if (refreshTokenHash === null) {
      await this.repository.update({ id }, { refreshTokenHash: null, refreshTokenHashes: [] });
    } else {
      await this.addRefreshTokenHash(id, refreshTokenHash);
    }
  }

  async addRefreshTokenHash(id: string, newHash: string, maxSessions = 10): Promise<void> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return;
    const current = user.refreshTokenHashes && user.refreshTokenHashes.length > 0
      ? user.refreshTokenHashes
      : (user.refreshTokenHash ? [user.refreshTokenHash] : []);
    const updated = [...current.filter((h) => h !== newHash), newHash].slice(-maxSessions);
    await this.repository.update({ id }, {
      refreshTokenHash: newHash,
      refreshTokenHashes: updated,
    });
  }

  async removeRefreshTokenHash(id: string, hashToRemove: string): Promise<void> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return;
    const current = user.refreshTokenHashes && user.refreshTokenHashes.length > 0
      ? user.refreshTokenHashes
      : (user.refreshTokenHash ? [user.refreshTokenHash] : []);
    const updated = current.filter((h) => h !== hashToRemove);
    const latest = updated.length > 0 ? updated[updated.length - 1] : null;
    await this.repository.update({ id }, {
      refreshTokenHash: latest,
      refreshTokenHashes: updated,
    });
  }

  async setTelegramLinkToken(id: string, telegramLinkToken: string, telegramLinkTokenExpiresAt: Date): Promise<void> {
    await this.repository.update({ id }, { telegramLinkToken, telegramLinkTokenExpiresAt });
  }

  // Rotates a specific device's refresh token hash in the array while preserving
  // other active sessions for this account.
  async rotateRefreshTokenHash(id: string, previousHash: string, newHash: string): Promise<boolean> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return false;
    const current = user.refreshTokenHashes && user.refreshTokenHashes.length > 0
      ? user.refreshTokenHashes
      : (user.refreshTokenHash ? [user.refreshTokenHash] : []);

    const index = current.indexOf(previousHash);
    if (index === -1) {
      if (user.refreshTokenHash === previousHash) {
        await this.repository.update({ id }, {
          refreshTokenHash: newHash,
          refreshTokenHashes: [newHash],
        });
        return true;
      }
      return false;
    }

    const updated = [...current];
    updated[index] = newHash;
    await this.repository.update({ id }, {
      refreshTokenHash: newHash,
      refreshTokenHashes: updated,
    });
    return true;
  }

  async updateRole(id: string, role: UserRole): Promise<void> {
    await this.repository.update({ id }, { role });
  }

  async updateAdminRestriction(id: string, cannotManageAdmins: boolean): Promise<void> {
    await this.repository.update({ id }, { cannotManageAdmins });
  }

  async setVip(id: string, isVip: boolean): Promise<void> {
    await this.repository.update({ id }, { isVip });
  }

  async updatePermissionGroup(id: string, permissionGroupId: string | null): Promise<void> {
    await this.repository.update({ id }, { permissionGroupId });
  }

  async updateProfile(id: string, data: UpdateUserProfileData): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id }, { passwordHash });
  }

  async setTwoFactor(id: string, data: { totpSecretEncrypted: string | null; twoFactorEnabled: boolean }): Promise<void> {
    await this.repository.update({ id }, data);
  }

  // Soft delete — sets deleted_at, which every plain find() elsewhere
  // (login, assignee pickers, /users/me) already treats as "doesn't exist".
  // No actual row/FK is touched, so every ticket/comment/activity this
  // person ever authored keeps pointing at the same real row.
  async deactivate(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  async reactivate(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  // Oldest first — a FIFO queue for the admin pending-registrations modal.
  // No pagination: only self-registration ever leaves approved_at null, so
  // volume is expected to stay small, and the partial index on this exact
  // predicate (see migration 1784400000000) keeps it cheap regardless.
  findPending(): Promise<UserEntity[]> {
    return this.repository.find({ where: { approvedAt: IsNull() }, order: { createdAt: 'ASC' } });
  }

  // Conditioned on `approved_at IS NULL` (not a plain `WHERE id = ...`) so
  // two concurrent approve/reject calls on the same row can't both "succeed"
  // — whichever write lands first flips the predicate, so the second one's
  // UPDATE affects zero rows instead of silently overwriting or racing past
  // it. Callers check the returned boolean rather than trusting their own
  // earlier read.
  async setApprovedAtIfPending(id: string, approvedAt: Date): Promise<boolean> {
    const result = await this.repository.update({ id, approvedAt: IsNull() }, { approvedAt });
    return (result.affected ?? 0) > 0;
  }

  // Real DELETE, not softDelete — see UsersService.reject for why a
  // never-approved row is safe to remove outright. Same `approved_at IS
  // NULL` condition as setApprovedAtIfPending, for the same reason.
  async hardDeleteIfPending(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id, approvedAt: IsNull() });
    return (result.affected ?? 0) > 0;
  }
}
