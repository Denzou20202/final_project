import { EmployeeStatusEntity, EmployeeStatusHistoryEntity, PresenceSettingsEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEmployeeStatusDto } from './dto/create-employee-status.dto.js';

const SETTINGS_ROW_ID = 1;
const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 15;
const HISTORY_PAGE_SIZE = 100;

@Injectable()
export class EmployeeStatusesRepository {
  constructor(
    @InjectRepository(EmployeeStatusEntity)
    private readonly statusesRepository: Repository<EmployeeStatusEntity>,
    @InjectRepository(EmployeeStatusHistoryEntity)
    private readonly historyRepository: Repository<EmployeeStatusHistoryEntity>,
    @InjectRepository(PresenceSettingsEntity)
    private readonly settingsRepository: Repository<PresenceSettingsEntity>,
  ) {}

  create(dto: CreateEmployeeStatusDto): Promise<EmployeeStatusEntity> {
    return this.statusesRepository.save(
      this.statusesRepository.create({
        name: dto.name,
        nameUk: dto.nameUk ?? null,
        nameEn: dto.nameEn ?? null,
        color: dto.color,
      }),
    );
  }

  findAll(): Promise<EmployeeStatusEntity[]> {
    return this.statusesRepository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<EmployeeStatusEntity | null> {
    return this.statusesRepository.findOne({ where: { id } });
  }

  async update(id: string, patch: Partial<Pick<EmployeeStatusEntity, 'name' | 'nameUk' | 'nameEn' | 'color'>>): Promise<void> {
    await this.statusesRepository.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    // Members currently on this status fall back to «Онлайн» — users.current_status_id
    // is FK ON DELETE SET NULL (see migration). Past history rows keep their
    // own denormalized name/color and are unaffected.
    await this.statusesRepository.delete({ id });
  }

  // A missing row means "never configured" — the caller gets the same
  // default (15) either way, no row is written until an admin actually
  // changes it (no seed data in the migration).
  async findSettings(): Promise<PresenceSettingsEntity> {
    const existing = await this.settingsRepository.findOne({ where: { id: SETTINGS_ROW_ID } });
    return existing ?? { id: SETTINGS_ROW_ID, inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES };
  }

  async upsertSettings(inactivityTimeoutMinutes: number): Promise<PresenceSettingsEntity> {
    await this.settingsRepository.upsert({ id: SETTINGS_ROW_ID, inactivityTimeoutMinutes }, ['id']);
    return { id: SETTINGS_ROW_ID, inactivityTimeoutMinutes };
  }

  findHistoryByUserId(userId: string): Promise<EmployeeStatusHistoryEntity[]> {
    return this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: HISTORY_PAGE_SIZE,
    });
  }
}
