import { TicketCategoryEntity, TicketEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TicketCategoriesRepository {
  constructor(
    @InjectRepository(TicketCategoryEntity)
    private readonly categoriesRepository: Repository<TicketCategoryEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
  ) {}

  findAll(): Promise<TicketCategoryEntity[]> {
    return this.categoriesRepository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<TicketCategoryEntity | null> {
    return this.categoriesRepository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<TicketCategoryEntity | null> {
    return this.categoriesRepository.findOne({ where: { name } });
  }

  async create(name: string, nameUk?: string | null, nameEn?: string | null): Promise<TicketCategoryEntity> {
    return this.categoriesRepository.save(this.categoriesRepository.create({ name, nameUk, nameEn }));
  }

  async updateName(id: string, name: string, nameUk?: string | null, nameEn?: string | null): Promise<void> {
    await this.categoriesRepository.update({ id }, { name, nameUk, nameEn });
  }

  // Backs the delete-category guard's rejection message only —
  // TicketCategoriesService.remove() no longer uses this to DECIDE whether
  // to delete (see deleteIfUnused below for the actual atomic guard).
  // withDeleted: tickets.category_id is ON DELETE NO ACTION, which fires
  // against ALL rows regardless of soft-delete status — a plain .count()
  // excluding trashed tickets would undercount against what the DB
  // constraint actually checks.
  countTicketsForCategory(categoryId: string): Promise<number> {
    return this.ticketsRepository.count({ where: { categoryId }, withDeleted: true });
  }

  // Atomic guarded delete — see TagsRepository.deleteIfUnused's comment for
  // the TOCTOU this closes (a ticket categorized between the count-check
  // and the delete). tickets.category_id is ON DELETE NO ACTION rather than
  // CASCADE, so the failure mode without this used to be a raw, unhandled
  // Postgres FK-violation (500) instead of silent data loss — still worth
  // closing for the same reason the team-delete guard's undercount was.
  // Returns whether a row was actually deleted.
  async deleteIfUnused(id: string): Promise<boolean> {
    const result = await this.categoriesRepository
      .createQueryBuilder()
      .delete()
      .from(TicketCategoryEntity)
      .where('id = :id AND NOT EXISTS (SELECT 1 FROM tickets WHERE category_id = :id)', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
