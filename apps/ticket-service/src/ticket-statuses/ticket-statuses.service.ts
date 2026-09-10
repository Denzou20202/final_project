import { TicketStatusEntity } from '@veloxdesk/database';
import { PublicTicketStatus } from '@veloxdesk/types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateTicketStatusDto } from './dto/create-ticket-status.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { TicketStatusesRepository } from './ticket-statuses.repository.js';
import { toPublicTicketStatus } from './ticket-status.public.js';

@Injectable()
export class TicketStatusesService {
  constructor(
    private readonly statusesRepository: TicketStatusesRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listAll(): Promise<PublicTicketStatus[]> {
    const statuses = await this.statusesRepository.findAll();
    return statuses.map(toPublicTicketStatus);
  }

  private async getOrThrow(id: string): Promise<TicketStatusEntity> {
    const status = await this.statusesRepository.findById(id);
    if (!status) {
      throw new NotFoundException('Ticket status not found');
    }
    return status;
  }

  async create(dto: CreateTicketStatusDto): Promise<PublicTicketStatus> {
    const sortOrder = await this.statusesRepository.nextSortOrder();
    const status = await this.statusesRepository.create({
      name: dto.name.trim(),
      nameUk: dto.nameUk?.trim() || null,
      nameEn: dto.nameEn?.trim() || null,
      color: dto.color,
      isClosed: dto.isClosed ?? false,
      tracksSla: dto.tracksSla ?? true,
      sortOrder,
    });
    // isDefault on create goes through the same exclusivity path as update
    // (rather than a bespoke insert-time branch) so there's exactly one
    // place that owns "only one row may be default".
    if (dto.isDefault) {
      return this.update(status.id, { isDefault: true });
    }
    return toPublicTicketStatus(status);
  }

  async update(id: string, dto: UpdateTicketStatusDto): Promise<PublicTicketStatus> {
    const status = await this.getOrThrow(id);

    if (dto.isDefault === false && status.isDefault) {
      throw new BadRequestException(
        'Нельзя снять единственный статус по умолчанию — сначала назначьте другой статус по умолчанию.',
      );
    }

    const patch: Partial<Pick<TicketStatusEntity, 'name' | 'nameUk' | 'nameEn' | 'color' | 'isClosed' | 'tracksSla'>> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.nameUk !== undefined) patch.nameUk = dto.nameUk.trim() || null;
    if (dto.nameEn !== undefined) patch.nameEn = dto.nameEn.trim() || null;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.isClosed !== undefined) patch.isClosed = dto.isClosed;
    if (dto.tracksSla !== undefined) patch.tracksSla = dto.tracksSla;

    if (dto.isDefault === true && !status.isDefault) {
      // Atomic swap — a status becoming the new default must, in the same
      // transaction, unset whichever row currently holds it, so the catalog
      // is never briefly (or permanently, on a crash) left with zero or two
      // defaults.
      await this.dataSource.transaction(async (manager) => {
        await manager.update(TicketStatusEntity, { isDefault: true }, { isDefault: false });
        await manager.update(TicketStatusEntity, { id }, { ...patch, isDefault: true });
      });
    } else if (Object.keys(patch).length > 0) {
      await this.statusesRepository.update(id, patch);
    }

    const updated = await this.getOrThrow(id);
    return toPublicTicketStatus(updated);
  }

  // Mirrors TagsService.remove()/TicketCategoriesService.remove()'s atomic
  // deleteIfUnused shape, plus the isDefault guard a required (NOT NULL)
  // ticket.status_id needs that those nullable-FK catalogs don't.
  // countTicketsForStatus is only used afterward, to put a number in the
  // rejection message.
  async remove(id: string): Promise<void> {
    const status = await this.getOrThrow(id);
    if (status.isDefault) {
      throw new BadRequestException(
        `Нельзя удалить статус по умолчанию «${status.name}» — сначала назначьте другой статус по умолчанию.`,
      );
    }
    const deleted = await this.statusesRepository.deleteIfUnused(id);
    if (!deleted) {
      const ticketCount = await this.statusesRepository.countTicketsForStatus(id);
      throw new BadRequestException(
        `Нельзя удалить статус «${status.name}» — им отмечены тикеты (${ticketCount}).`,
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
    const status = await this.getOrThrow(id);
    const neighbor = await this.statusesRepository.findNeighbor(status.sortOrder, direction);
    if (!neighbor) return;
    await this.statusesRepository.swapSortOrder(status.id, status.sortOrder, neighbor.id, neighbor.sortOrder);
  }
}
