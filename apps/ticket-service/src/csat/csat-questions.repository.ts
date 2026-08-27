import { CsatQuestionEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

@Injectable()
export class CsatQuestionsRepository {
  constructor(
    @InjectRepository(CsatQuestionEntity)
    private readonly repository: Repository<CsatQuestionEntity>,
  ) {}

  create(data: { text: string; isEnabled?: boolean; sortOrder?: number }): Promise<CsatQuestionEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<CsatQuestionEntity[]> {
    return this.repository.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  findEnabled(): Promise<CsatQuestionEntity[]> {
    return this.repository.find({ where: { isEnabled: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  findById(id: string): Promise<CsatQuestionEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByIds(ids: string[]): Promise<CsatQuestionEntity[]> {
    return this.repository.find({ where: { id: In(ids) } });
  }

  async update(id: string, data: Partial<{ text: string; isEnabled: boolean; sortOrder: number }>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
