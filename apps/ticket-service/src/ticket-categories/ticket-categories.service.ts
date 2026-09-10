import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PublicTicketCategory, toPublicTicketCategory } from './ticket-category.public.js';
import { TicketCategoriesRepository } from './ticket-categories.repository.js';

@Injectable()
export class TicketCategoriesService {
  constructor(private readonly categoriesRepository: TicketCategoriesRepository) {}

  async listAll(): Promise<PublicTicketCategory[]> {
    const categories = await this.categoriesRepository.findAll();
    return categories.map(toPublicTicketCategory);
  }

  async create(name: string, nameUk?: string, nameEn?: string): Promise<PublicTicketCategory> {
    const trimmed = name.trim();
    const collision = await this.categoriesRepository.findByName(trimmed);
    if (collision) {
      throw new ConflictException(`Категория «${trimmed}» уже существует`);
    }
    const category = await this.categoriesRepository.create(
      trimmed,
      nameUk?.trim() || null,
      nameEn?.trim() || null,
    );
    return toPublicTicketCategory(category);
  }

  // Admin-only, global — renaming changes what every ticket already carrying
  // this category displays, not just this one request's view of it. Mirrors
  // TagsService.rename().
  async rename(id: string, name: string, nameUk?: string, nameEn?: string): Promise<PublicTicketCategory> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const trimmed = name.trim();
    const trimmedUk = nameUk?.trim() || null;
    const trimmedEn = nameEn?.trim() || null;
    const nameChanged = trimmed !== category.name;

    if (nameChanged) {
      const collision = await this.categoriesRepository.findByName(trimmed);
      if (collision) {
        throw new ConflictException(`Категория «${trimmed}» уже существует`);
      }
    }

    if (!nameChanged && trimmedUk === (category.nameUk ?? null) && trimmedEn === (category.nameEn ?? null)) {
      return toPublicTicketCategory(category);
    }

    await this.categoriesRepository.updateName(id, trimmed, trimmedUk, trimmedEn);
    return toPublicTicketCategory({ ...category, name: trimmed, nameUk: trimmedUk, nameEn: trimmedEn });
  }

  // Guarded at the app level (not just the DB — see the migration's own
  // comment on tickets.category_id). Unlike TeamsService.remove()'s plain
  // count-then-reject, the guard itself is the atomic conditional delete in
  // deleteIfUnused() — mirrors TagsService.remove() exactly.
  // countTicketsForCategory is only used afterward, to put a number in the
  // rejection message.
  async remove(id: string): Promise<void> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const deleted = await this.categoriesRepository.deleteIfUnused(id);
    if (!deleted) {
      const ticketCount = await this.categoriesRepository.countTicketsForCategory(id);
      throw new BadRequestException(
        `Нельзя удалить категорию «${category.name}» — на неё ссылаются тикеты (${ticketCount}). Сначала смените категорию в этих тикетах.`,
      );
    }
  }
}
