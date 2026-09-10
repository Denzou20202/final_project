import { MacroEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class MacrosRepository {
  constructor(
    @InjectRepository(MacroEntity)
    private readonly repository: Repository<MacroEntity>,
  ) {}

  create(data: { title: string; titleUk?: string; titleEn?: string; body: string }): Promise<MacroEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<MacroEntity[]> {
    return this.repository.find({ order: { title: 'ASC' } });
  }

  findById(id: string): Promise<MacroEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<{ title: string; titleUk: string; titleEn: string; body: string }>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
