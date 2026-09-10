import { JwtPayload, SearchIndexProducerService } from '@veloxdesk/common';
import { TicketActivityType } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketActivityRepository } from '../tickets/ticket-activity.repository.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { PublicTag, toPublicTag } from './tag.public.js';
import { TagsRepository } from './tags.repository.js';

@Injectable()
export class TagsService {
  constructor(
    private readonly tagsRepository: TagsRepository,
    private readonly ticketsService: TicketsService,
    private readonly activityRepository: TicketActivityRepository,
    private readonly searchIndexProducer: SearchIndexProducerService,
  ) {}

  async listAll(): Promise<PublicTag[]> {
    const tags = await this.tagsRepository.findAll();
    return tags.map(toPublicTag);
  }

  // Admin-only, global — same tier as remove() above: renaming changes what
  // every ticket already carrying this tag displays, not just this one
  // request's view of it.
  async rename(id: string, name: string, nameUk?: string, nameEn?: string): Promise<PublicTag> {
    const tag = await this.tagsRepository.findById(id);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    const trimmed = name.trim();
    const trimmedUk = nameUk?.trim() || null;
    const trimmedEn = nameEn?.trim() || null;
    const nameChanged = trimmed !== tag.name;

    if (nameChanged) {
      const collision = await this.tagsRepository.findByName(trimmed);
      if (collision) {
        throw new BadRequestException(`Метка с названием «${trimmed}» уже существует`);
      }
    }

    // A true no-op (name AND both variants unchanged) skips the write
    // entirely — otherwise even a same-name resubmit would still need to
    // persist a corrected uk/en translation.
    if (!nameChanged && trimmedUk === (tag.nameUk ?? null) && trimmedEn === (tag.nameEn ?? null)) {
      return toPublicTag(tag);
    }

    await this.tagsRepository.updateName(id, trimmed, trimmedUk, trimmedEn);
    return toPublicTag({ ...tag, name: trimmed, nameUk: trimmedUk, nameEn: trimmedEn });
  }

  async getForTicket(ticketId: string, actor: JwtPayload): Promise<PublicTag[]> {
    await this.ticketsService.assertAccess(ticketId, actor);
    const tags = await this.tagsRepository.findByTicket(ticketId);
    return tags.map(toPublicTag);
  }

  async addToTicket(ticketId: string, name: string, actor: JwtPayload): Promise<PublicTag> {
    await this.ticketsService.assertAccess(ticketId, actor);
    const trimmed = name.trim();
    const tag = await this.tagsRepository.findOrCreateByName(trimmed);

    const alreadyLinked = await this.tagsRepository.isLinked(ticketId, tag.id);
    if (!alreadyLinked) {
      await this.tagsRepository.linkToTicket(ticketId, tag.id);
      await this.activityRepository.log({
        ticketId,
        actorId: actor.sub,
        type: TicketActivityType.TAG_ADDED,
        toValue: tag.name,
      });
      await this.searchIndexProducer.enqueueTicket(ticketId);
    }

    return toPublicTag(tag);
  }

  async removeFromTicket(ticketId: string, tagId: string, actor: JwtPayload): Promise<void> {
    await this.ticketsService.assertAccess(ticketId, actor);
    const tag = await this.tagsRepository.findById(tagId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    const removed = await this.tagsRepository.unlinkFromTicket(ticketId, tagId);
    if (removed) {
      await this.activityRepository.log({
        ticketId,
        actorId: actor.sub,
        type: TicketActivityType.TAG_REMOVED,
        fromValue: tag.name,
      });
      await this.searchIndexProducer.enqueueTicket(ticketId);
    }
  }

  // Admin-only, global — removes the tag from the catalog itself, not just
  // one ticket. Guarded at the app level (not the DB — ticket_tags.tag_id is
  // ON DELETE CASCADE, so an unconditional delete would silently detach the
  // tag from every ticket that still has it, with no activity-log entry and
  // no search reindex). Unlike TeamsService.remove()'s plain count-then-
  // reject, the guard itself is the atomic conditional delete in
  // deleteIfUnused() — a separate count-check here followed by a delete()
  // would leave the same TOCTOU race deleteIfUnused's own comment describes
  // (a tag just linked to a ticket, between the check and the delete,
  // getting silently cascaded away). countTicketsForTag is only used
  // afterward, to put a number in the rejection message.
  async remove(id: string): Promise<void> {
    const tag = await this.tagsRepository.findById(id);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    const deleted = await this.tagsRepository.deleteIfUnused(id);
    if (!deleted) {
      const ticketCount = await this.tagsRepository.countTicketsForTag(id);
      throw new BadRequestException(
        `Нельзя удалить метку «${tag.name}» — ею отмечены тикеты (${ticketCount}).`,
      );
    }
  }
}
