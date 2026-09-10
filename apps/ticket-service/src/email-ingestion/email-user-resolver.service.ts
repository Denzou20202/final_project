import { UserEntity } from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class EmailUserResolverService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  // Finds the client account for an inbound email's sender, auto-provisioning
  // one if this is the first time we've heard from this address. The account
  // gets an unusable random password hash — the owner never set one, and
  // logging in via password is a separate flow (out of scope here) they'd
  // need to claim via "forgot password" later.
  //
  // Returns null when the address belongs to a staff (operator/admin)
  // account instead of a client one — the support mailbox has no way to
  // authenticate a From: header (no SPF/DKIM/DMARC check happens anywhere
  // in this app), so anyone can put an admin's real address in From: and
  // have this resolve straight to that admin's own UserEntity, attributing
  // a forged ticket/reply to them. There is no safe "treat as a new
  // identity" fallback either — email has a global unique index, so a
  // second row for the same address can't be created. The caller treats
  // null exactly like an unparseable From address: log and drop the
  // message, still flagging it \Seen (see EmailIngestionService.processMessage).
  async findOrCreateByEmail(email: string, displayName?: string): Promise<UserEntity | null> {
    const normalizedEmail = email.trim().toLowerCase();
    // withDeleted: email has a plain global unique index, not partial on
    // deleted_at IS NULL — a deactivated account still holds its address at
    // the DB level. Without this, a message from a deactivated employee/
    // contact's old address missed the check below and the INSERT further
    // down hit a raw unique-violation every single poll, forever (this
    // method throwing leaves the message unflagged \Seen — see
    // EmailIngestionService.processUnseenMessages).
    const existing = await this.usersRepository.findOne({ where: { email: normalizedEmail }, withDeleted: true });
    if (existing) {
      return existing.role === UserRole.CLIENT && !existing.deletedAt ? existing : null;
    }

    const unusablePasswordHash = await bcrypt.hash(randomUUID(), PASSWORD_SALT_ROUNDS);
    const user = this.usersRepository.create({
      email: normalizedEmail,
      fullName: displayName?.trim() || normalizedEmail.split('@')[0],
      role: UserRole.CLIENT,
      passwordHash: unusablePasswordHash,
    });
    return this.usersRepository.save(user);
  }
}
