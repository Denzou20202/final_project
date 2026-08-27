import {
  AttachmentEntity,
  CommentEntity,
  NotificationEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { PublicUser, toPublicUser } from '../users/user.public.js';
import { toCsv } from './csv.js';
import { DuplicateMatchSignal, PublicDuplicateGroup } from './contact.public.js';
import { MergeContactsDto } from './dto/merge-contacts.dto.js';

const CONTACT_CSV_HEADERS = [
  'ФИО',
  'Email',
  'Телефон',
  'Компания',
  'Отдел',
  'Должность',
  'Имя компьютера',
  'Город',
  'Дата регистрации',
  'Статус',
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Phone/name only count as a match signal past a minimum length — otherwise
// two contacts who both simply left the field blank-ish (e.g. a lone "-")
// would get flagged as duplicates of everyone else who did the same.
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 5 ? digits : null;
}

function normalizeName(fullName: string): string | null {
  const normalized = fullName.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized.length >= 3 ? normalized : null;
}

// Plain union-find over contact ids — links formed by findDuplicateGroups()
// below get merged into connected components so a chain (A~B by email,
// B~C by phone) surfaces as one group instead of two overlapping pairs.
class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    const current = this.parent.get(x) ?? x;
    if (current === x) {
      this.parent.set(x, x);
      return x;
    }
    const root = this.find(current);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async exportCsv(): Promise<string> {
    const contacts = await this.usersRepository.find({
      where: { role: UserRole.CLIENT },
      withDeleted: true,
      order: { fullName: 'ASC' },
    });

    const rows = contacts.map((c) => [
      c.fullName,
      c.email,
      c.phone ?? '',
      c.company ?? '',
      c.department ?? '',
      c.position ?? '',
      c.computerName ?? '',
      c.city ?? '',
      c.createdAt.toISOString().slice(0, 10),
      c.deletedAt ? 'Деактивирован' : 'Активен',
    ]);

    return toCsv(CONTACT_CSV_HEADERS, rows);
  }

  // Heuristic, not a hard rule: any two active (non-deactivated,
  // non-merged) clients sharing a normalized email, phone, or name are
  // flagged as candidates — merging itself always stays a manual, admin-
  // confirmed action (see merge() below), this only surfaces the list.
  async findDuplicateGroups(): Promise<PublicDuplicateGroup[]> {
    const contacts = await this.usersRepository.find({
      where: { role: UserRole.CLIENT },
      order: { createdAt: 'ASC' },
    });
    if (contacts.length < 2) return [];

    const keysByContact = new Map(
      contacts.map((c) => [
        c.id,
        { email: normalizeEmail(c.email), phone: normalizePhone(c.phone), name: normalizeName(c.fullName) },
      ]),
    );

    const uf = new UnionFind();
    const signals = ['email', 'phone', 'name'] as const;
    for (const signal of signals) {
      const buckets = new Map<string, string[]>();
      for (const c of contacts) {
        const key = keysByContact.get(c.id)?.[signal];
        if (!key) continue;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(c.id);
        else buckets.set(key, [c.id]);
      }
      for (const ids of buckets.values()) {
        for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i]);
      }
    }

    const groupedIds = new Map<string, string[]>();
    for (const c of contacts) {
      const root = uf.find(c.id);
      const group = groupedIds.get(root);
      if (group) group.push(c.id);
      else groupedIds.set(root, [c.id]);
    }

    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const result: PublicDuplicateGroup[] = [];
    for (const [groupId, ids] of groupedIds) {
      if (ids.length < 2) continue;

      const matchedOn: DuplicateMatchSignal[] = [];
      for (const signal of signals) {
        const values = ids.map((id) => keysByContact.get(id)?.[signal]).filter((v): v is string => !!v);
        if (new Set(values).size < values.length) matchedOn.push(signal);
      }

      result.push({
        groupId,
        matchedOn,
        contacts: ids.map((id) => toPublicUser(contactById.get(id) as UserEntity)),
      });
    }
    return result;
  }

  // Repoints every FK a CLIENT contact can plausibly own (tickets they
  // created, comments/attachments they authored, watcher rows, activity-log
  // entries, notification rows) from each duplicate onto the chosen primary,
  // then soft-deletes the duplicate and flags it mergedIntoId — mirrors
  // TicketsService.merge()'s own transaction + affected-check pattern.
  async merge(dto: MergeContactsDto): Promise<PublicUser> {
    if (dto.duplicateIds.includes(dto.primaryId)) {
      throw new BadRequestException('A contact cannot be merged into itself');
    }

    const ids = [dto.primaryId, ...dto.duplicateIds];
    const contacts = await this.usersRepository.find({ where: { id: In(ids), role: UserRole.CLIENT } });
    if (contacts.length !== ids.length) {
      throw new BadRequestException(
        'One or more contacts were not found, are not clients, or were already deactivated/merged',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Row-lock the primary too, not just each loser (see the per-loser
      // conditional update below) — without this, two concurrent merges
      // where one's primary is another's loser (X merged into Z, Y merged
      // into X, both racing) could both pass their pre-transaction checks
      // and interleave into a state a single merge chain isn't meant to
      // produce. FOR UPDATE here contends with the exact same row a
      // concurrent merge naming this contact as ITS primary would also try
      // to lock, so the two calls serialize instead of racing.
      const primaryRow = await manager
        .createQueryBuilder(UserEntity, 'u')
        .withDeleted()
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: dto.primaryId })
        .getOne();
      if (!primaryRow || primaryRow.mergedIntoId) {
        throw new BadRequestException('Primary contact was already merged into another contact');
      }

      for (const loserId of dto.duplicateIds) {
        await manager.update(TicketEntity, { createdBy: loserId }, { createdBy: dto.primaryId });
        await manager.update(TicketEntity, { createdOnBehalfBy: loserId }, { createdOnBehalfBy: dto.primaryId });
        await manager.update(CommentEntity, { authorId: loserId }, { authorId: dto.primaryId });
        await manager.update(AttachmentEntity, { uploaderId: loserId }, { uploaderId: dto.primaryId });
        await manager.update(TicketActivityEntity, { actorId: loserId }, { actorId: dto.primaryId });
        await manager.update(NotificationEntity, { userId: loserId }, { userId: dto.primaryId });

        // Watchers carry a UNIQUE(ticket_id, user_id) constraint — if the
        // primary already watches a ticket the loser also watches, a plain
        // repoint would collide. Drop the loser's row for those tickets
        // first, then repoint whatever's left.
        await manager
          .createQueryBuilder()
          .delete()
          .from(TicketWatcherEntity)
          .where(
            'user_id = :loserId AND ticket_id IN (SELECT ticket_id FROM ticket_watchers WHERE user_id = :primaryId)',
            { loserId, primaryId: dto.primaryId },
          )
          .execute();
        await manager.update(TicketWatcherEntity, { userId: loserId }, { userId: dto.primaryId });

        // Re-checked inside the transaction (not just the pre-check above) —
        // guards against a second concurrent merge racing the same loser.
        const result = await manager.update(UserEntity, { id: loserId, mergedIntoId: IsNull() }, { mergedIntoId: dto.primaryId });
        if (!result.affected) {
          throw new BadRequestException(`Contact ${loserId} was already merged into another contact`);
        }
        await manager.softDelete(UserEntity, loserId);
      }
    });

    const primary = await this.usersRepository.findOneOrFail({ where: { id: dto.primaryId } });
    return toPublicUser(primary);
  }
}
