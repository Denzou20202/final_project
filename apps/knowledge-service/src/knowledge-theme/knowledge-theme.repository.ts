import { KnowledgeThemeEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

const SETTINGS_ROW_ID = 1;

@Injectable()
export class KnowledgeThemeRepository {
  constructor(
    @InjectRepository(KnowledgeThemeEntity)
    private readonly repository: Repository<KnowledgeThemeEntity>,
  ) {}

  // A missing row means "never customized" — same convention as
  // PresenceSettingsEntity: no seed data in the migration, the service
  // layer supplies the "nothing set" default (both null) until an admin
  // actually saves something.
  async findTheme(): Promise<KnowledgeThemeEntity> {
    const existing = await this.repository.findOne({ where: { id: SETTINGS_ROW_ID } });
    return existing ?? { id: SETTINGS_ROW_ID, customCss: null, customJs: null };
  }

  async upsertTheme(customCss: string | null, customJs: string | null): Promise<KnowledgeThemeEntity> {
    await this.repository.upsert({ id: SETTINGS_ROW_ID, customCss, customJs }, ['id']);
    return { id: SETTINGS_ROW_ID, customCss, customJs };
  }
}
