import { Injectable } from '@nestjs/common';
import { UpdateKnowledgeThemeDto } from './dto/update-knowledge-theme.dto.js';
import { KnowledgeThemeRepository } from './knowledge-theme.repository.js';

export interface PublicKnowledgeTheme {
  customCss: string | null;
  customJs: string | null;
}

@Injectable()
export class KnowledgeThemeService {
  constructor(private readonly repository: KnowledgeThemeRepository) {}

  async get(): Promise<PublicKnowledgeTheme> {
    const theme = await this.repository.findTheme();
    return { customCss: theme.customCss ?? null, customJs: theme.customJs ?? null };
  }

  // Empty string clears the field (consistent with the free-text profile
  // fields elsewhere — e.g. UsersService.updateProfile) — an admin blanking
  // out the textarea and saving is how customization gets removed, there's
  // no separate "clear" action.
  async update(dto: UpdateKnowledgeThemeDto): Promise<PublicKnowledgeTheme> {
    const theme = await this.repository.upsertTheme(dto.customCss || null, dto.customJs || null);
    return { customCss: theme.customCss ?? null, customJs: theme.customJs ?? null };
  }
}
