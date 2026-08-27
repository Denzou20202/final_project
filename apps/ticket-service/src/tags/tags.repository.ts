import { TagEntity, TicketTagEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TagsRepository {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagsRepository: Repository<TagEntity>,
    @InjectRepository(TicketTagEntity)
    private readonly ticketTagsRepository: Repository<TicketTagEntity>,
  ) {}

  findAll(): Promise<TagEntity[]> {
    return this.tagsRepository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<TagEntity | null> {
    return this.tagsRepository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<TagEntity | null> {
    return this.tagsRepository.findOne({ where: { name } });
  }

  async updateName(id: string, name: string, nameUk?: string | null, nameEn?: string | null): Promise<void> {
    await this.tagsRepository.update({ id }, { name, nameUk, nameEn });
  }

  async findOrCreateByName(name: string): Promise<TagEntity> {
    const existing = await this.tagsRepository.findOne({ where: { name } });
    if (existing) return existing;
    // A concurrent request could create the same tag between the read above
    // and this save — the unique index on `name` is the real guarantee;
    // fall back to re-reading on that race rather than surfacing a 500.
    try {
      return await this.tagsRepository.save(this.tagsRepository.create({ name }));
    } catch {
      const createdConcurrently = await this.tagsRepository.findOne({ where: { name } });
      if (createdConcurrently) return createdConcurrently;
      throw new Error(`Failed to create or find tag "${name}"`);
    }
  }

  findByTicket(ticketId: string): Promise<TagEntity[]> {
    return this.tagsRepository
      .createQueryBuilder('tag')
      .innerJoin('ticket_tags', 'tt', 'tt.tag_id = tag.id')
      .where('tt.ticket_id = :ticketId', { ticketId })
      .orderBy('tag.name', 'ASC')
      .getMany();
  }

  async isLinked(ticketId: string, tagId: string): Promise<boolean> {
    const count = await this.ticketTagsRepository.count({ where: { ticketId, tagId } });
    return count > 0;
  }

  async linkToTicket(ticketId: string, tagId: string): Promise<void> {
    // Idempotent — adding a tag that's already on the ticket is a no-op,
    // not a conflict the caller needs to handle.
    await this.ticketTagsRepository
      .createQueryBuilder()
      .insert()
      .into(TicketTagEntity)
      .values({ ticketId, tagId })
      .orIgnore()
      .execute();
  }

  // Returns whether a row was actually removed — TagsService.removeFromTicket
  // uses this to skip logging a TAG_REMOVED activity for a tag that was
  // already gone (e.g. a duplicate/retried request), mirroring the
  // alreadyLinked check addToTicket already does on the way in.
  async unlinkFromTicket(ticketId: string, tagId: string): Promise<boolean> {
    const result = await this.ticketTagsRepository.delete({ ticketId, tagId });
    return (result.affected ?? 0) > 0;
  }

  // Backs the delete-tag guard's rejection message only — TagsService.remove()
  // no longer uses this to DECIDE whether to delete (see deleteIfUnused
  // below for the actual atomic guard); it's read afterward purely to
  // report how many tickets reference the tag.
  countTicketsForTag(tagId: string): Promise<number> {
    return this.ticketTagsRepository.count({ where: { tagId } });
  }

  // Atomic guarded delete — a separate countTicketsForTag() check followed
  // by a plain delete() left a TOCTOU window open: a tag just added to a
  // ticket (addToTicket's linkToTicket landing between the count-check and
  // the delete) could get silently detached, since ticket_tags.tag_id is
  // ON DELETE CASCADE and would happily drop that brand-new row too, with
  // no error and no TAG_REMOVED activity logged for it. The NOT EXISTS
  // subquery is evaluated by Postgres as part of the same DELETE statement,
  // not against an earlier read, so there's no window for another
  // transaction to slip a ticket_tags row in between. Returns whether a row
  // was actually deleted.
  async deleteIfUnused(id: string): Promise<boolean> {
    const result = await this.tagsRepository
      .createQueryBuilder()
      .delete()
      .from(TagEntity)
      .where('id = :id AND NOT EXISTS (SELECT 1 FROM ticket_tags WHERE tag_id = :id)', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
