import { TicketEntity, TicketTypeEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TicketTypesRepository {
  constructor(
    @InjectRepository(TicketTypeEntity)
    private readonly typesRepository: Repository<TicketTypeEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
  ) {}

  findAll(): Promise<TicketTypeEntity[]> {
    return this.typesRepository.find({ order: { sortOrder: 'ASC' } });
  }

  findById(id: string): Promise<TicketTypeEntity | null> {
    return this.typesRepository.findOne({ where: { id } });
  }

  findDefault(): Promise<TicketTypeEntity | null> {
    return this.typesRepository.findOne({ where: { isDefault: true } });
  }

  // Backs the delete-type guard's rejection message only — see
  // TicketCategoriesRepository.countTicketsForCategory for the withDeleted
  // reasoning (tickets.type_id is ON DELETE RESTRICT, which fires against
  // trashed tickets too).
  countTicketsForType(typeId: string): Promise<number> {
    return this.ticketsRepository.count({ where: { typeId }, withDeleted: true });
  }

  // Atomic guarded delete — see TagsRepository.deleteIfUnused's comment for
  // the TOCTOU this closes. Returns whether a row was actually deleted.
  async deleteIfUnused(id: string): Promise<boolean> {
    const result = await this.typesRepository
      .createQueryBuilder()
      .delete()
      .from(TicketTypeEntity)
      .where('id = :id AND NOT EXISTS (SELECT 1 FROM tickets WHERE type_id = :id)', { id })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async nextSortOrder(): Promise<number> {
    const { max } = (await this.typesRepository
      .createQueryBuilder('t')
      .select('MAX(t.sortOrder)', 'max')
      .getRawOne<{ max: number | null }>()) ?? { max: null };
    return (max ?? 0) + 1;
  }

  async create(data: {
    name: string;
    nameUk?: string | null;
    nameEn?: string | null;
    color: string;
    weight: number;
    sortOrder: number;
  }): Promise<TicketTypeEntity> {
    const type = this.typesRepository.create(data);
    return this.typesRepository.save(type);
  }

  async update(
    id: string,
    patch: Partial<Pick<TicketTypeEntity, 'name' | 'nameUk' | 'nameEn' | 'color' | 'weight'>>,
  ): Promise<void> {
    await this.typesRepository.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.typesRepository.delete({ id });
  }

  // Simple adjacent-swap reordering — no drag-drop UI in this codebase to
  // justify a full reorder(orderedIds[]) endpoint, same as ticket_statuses.
  async findNeighbor(sortOrder: number, direction: 'up' | 'down'): Promise<TicketTypeEntity | null> {
    const qb = this.typesRepository.createQueryBuilder('t');
    if (direction === 'up') {
      qb.where('t.sortOrder < :sortOrder', { sortOrder }).orderBy('t.sortOrder', 'DESC');
    } else {
      qb.where('t.sortOrder > :sortOrder', { sortOrder }).orderBy('t.sortOrder', 'ASC');
    }
    return qb.getOne();
  }

  async swapSortOrder(idA: string, sortOrderA: number, idB: string, sortOrderB: number): Promise<void> {
    await this.typesRepository.manager.transaction(async (manager) => {
      await manager.update(TicketTypeEntity, { id: idA }, { sortOrder: sortOrderB });
      await manager.update(TicketTypeEntity, { id: idB }, { sortOrder: sortOrderA });
    });
  }
}
