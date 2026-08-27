import { TicketTypeEntity } from '@veloxdesk/database';
import { PublicTicketType } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto.js';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto.js';
import { TicketTypesRepository } from './ticket-types.repository.js';
import { toPublicTicketType } from './ticket-type.public.js';

@Injectable()
export class TicketTypesService {
  constructor(
    private readonly typesRepository: TicketTypesRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listAll(): Promise<PublicTicketType[]> {
    const types = await this.typesRepository.findAll();
    return types.map(toPublicTicketType);
  }

  private async getOrThrow(id: string): Promise<TicketTypeEntity> {
    const type = await this.typesRepository.findById(id);
    if (!type) {
      throw new NotFoundException('Ticket type not found');
    }
    return type;
  }

  async create(dto: CreateTicketTypeDto): Promise<PublicTicketType> {
    const sortOrder = await this.typesRepository.nextSortOrder();
    const type = await this.typesRepository.create({
      name: dto.name.trim(),
      nameUk: dto.nameUk?.trim() || null,
      nameEn: dto.nameEn?.trim() || null,
      color: dto.color,
      weight: dto.weight ?? 1,
      sortOrder,
    });
    // isDefault on create goes through the same exclusivity path as update
    // (rather than a bespoke insert-time branch) so there's exactly one
    // place that owns "only one row may be default".
    if (dto.isDefault) {
      return this.update(type.id, { isDefault: true });
    }
    return toPublicTicketType(type);
  }

  async update(id: string, dto: UpdateTicketTypeDto): Promise<PublicTicketType> {
    const type = await this.getOrThrow(id);

    if (dto.isDefault === false && type.isDefault) {
      throw new BadRequestException(
        'Нельзя снять единственный тип по умолчанию — сначала назначьте другой тип по умолчанию.',
      );
    }

    const patch: Partial<Pick<TicketTypeEntity, 'name' | 'nameUk' | 'nameEn' | 'color' | 'weight'>> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.nameUk !== undefined) patch.nameUk = dto.nameUk.trim() || null;
    if (dto.nameEn !== undefined) patch.nameEn = dto.nameEn.trim() || null;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.weight !== undefined) patch.weight = dto.weight;

    if (dto.isDefault === true && !type.isDefault) {
      // Atomic swap — a type becoming the new default must, in the same
      // transaction, unset whichever row currently holds it, so the catalog
      // is never briefly (or permanently, on a crash) left with zero or two
      // defaults.
      await this.dataSource.transaction(async (manager) => {
        await manager.update(TicketTypeEntity, { isDefault: true }, { isDefault: false });
        await manager.update(TicketTypeEntity, { id }, { ...patch, isDefault: true });
      });
    } else if (Object.keys(patch).length > 0) {
      await this.typesRepository.update(id, patch);
    }

    const updated = await this.getOrThrow(id);
    return toPublicTicketType(updated);
  }

  // Mirrors TicketStatusesService.remove()/TagsService.remove()'s atomic
  // deleteIfUnused shape, plus the isDefault guard a required (NOT NULL)
  // ticket.type_id needs. countTicketsForType is only used afterward, to
  // put a number in the rejection message.
  async remove(id: string): Promise<void> {
    const type = await this.getOrThrow(id);
    if (type.isDefault) {
      throw new BadRequestException(
        `Нельзя удалить тип по умолчанию «${type.name}» — сначала назначьте другой тип по умолчанию.`,
      );
    }
    const deleted = await this.typesRepository.deleteIfUnused(id);
    if (!deleted) {
      const ticketCount = await this.typesRepository.countTicketsForType(id);
      throw new BadRequestException(
        `Нельзя удалить тип «${type.name}» — им отмечены тикеты (${ticketCount}).`,
      );
    }
  }

  async moveUp(id: string): Promise<void> {
    await this.move(id, 'up');
  }

  async moveDown(id: string): Promise<void> {
    await this.move(id, 'down');
  }

  private async move(id: string, direction: 'up' | 'down'): Promise<void> {
    const type = await this.getOrThrow(id);
    const neighbor = await this.typesRepository.findNeighbor(type.sortOrder, direction);
    if (!neighbor) return;
    await this.typesRepository.swapSortOrder(type.id, type.sortOrder, neighbor.id, neighbor.sortOrder);
  }
}
