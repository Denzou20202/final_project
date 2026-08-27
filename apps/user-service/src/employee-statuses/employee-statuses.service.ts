import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEmployeeStatusDto } from './dto/create-employee-status.dto.js';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto.js';
import {
  PublicEmployeeStatus,
  PublicStatusHistoryEntry,
  toPublicEmployeeStatus,
  toPublicStatusHistoryEntry,
} from './employee-status.public.js';
import { EmployeeStatusesRepository } from './employee-statuses.repository.js';

export interface PublicPresenceSettings {
  inactivityTimeoutMinutes: number;
}

@Injectable()
export class EmployeeStatusesService {
  constructor(private readonly repository: EmployeeStatusesRepository) {}

  async create(dto: CreateEmployeeStatusDto): Promise<PublicEmployeeStatus> {
    const status = await this.repository.create(dto);
    return toPublicEmployeeStatus(status);
  }

  async list(): Promise<PublicEmployeeStatus[]> {
    const statuses = await this.repository.findAll();
    return statuses.map(toPublicEmployeeStatus);
  }

  async update(id: string, dto: UpdateEmployeeStatusDto): Promise<PublicEmployeeStatus> {
    await this.getOrThrow(id);
    const patch: Partial<{ name: string; nameUk: string; nameEn: string; color: string }> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.nameUk !== undefined) patch.nameUk = dto.nameUk;
    if (dto.nameEn !== undefined) patch.nameEn = dto.nameEn;
    if (dto.color !== undefined) patch.color = dto.color;
    if (Object.keys(patch).length > 0) {
      await this.repository.update(id, patch);
    }
    const updated = await this.getOrThrow(id);
    return toPublicEmployeeStatus(updated);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.delete(id);
  }

  async getSettings(): Promise<PublicPresenceSettings> {
    const settings = await this.repository.findSettings();
    return { inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes };
  }

  async updateSettings(inactivityTimeoutMinutes: number): Promise<PublicPresenceSettings> {
    const settings = await this.repository.upsertSettings(inactivityTimeoutMinutes);
    return { inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes };
  }

  async getHistoryForUser(userId: string): Promise<PublicStatusHistoryEntry[]> {
    const rows = await this.repository.findHistoryByUserId(userId);
    return rows.map(toPublicStatusHistoryEntry);
  }

  private async getOrThrow(id: string) {
    const status = await this.repository.findById(id);
    if (!status) {
      throw new NotFoundException('Employee status not found');
    }
    return status;
  }
}
