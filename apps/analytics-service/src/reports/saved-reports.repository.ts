import { SavedReportEntity } from '@veloxdesk/database';
import type { ReportFilters, ReportGroupBy } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface SavedReportData {
  name: string;
  groupBy: ReportGroupBy;
  filters: ReportFilters;
  columns?: string[] | null;
  createdBy?: string | null;
}

@Injectable()
export class SavedReportsRepository {
  constructor(
    @InjectRepository(SavedReportEntity)
    private readonly repository: Repository<SavedReportEntity>,
  ) {}

  create(data: SavedReportData): Promise<SavedReportEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<SavedReportEntity[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<SavedReportEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<SavedReportData>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
