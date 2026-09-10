import { Injectable, NotFoundException } from '@nestjs/common';
import { sanitizeCommentBody } from '@veloxdesk/common';
import { CreateMacroDto } from './dto/create-macro.dto.js';
import { UpdateMacroDto } from './dto/update-macro.dto.js';
import { MacrosRepository } from './macros.repository.js';
import { PublicMacro, toPublicMacro } from './macro.public.js';

@Injectable()
export class MacrosService {
  constructor(private readonly macrosRepository: MacrosRepository) {}

  // A macro's body is composed in the same Tiptap editor/schema as a real
  // reply (see ChatPanel/MacroModal), so it goes through the exact same
  // sanitizer — whatever's saved here is guaranteed to be exactly what
  // survives once the macro is applied to and sent as a ticket comment.
  async create(dto: CreateMacroDto): Promise<PublicMacro> {
    const macro = await this.macrosRepository.create({ ...dto, body: sanitizeCommentBody(dto.body) });
    return toPublicMacro(macro);
  }

  async list(): Promise<PublicMacro[]> {
    const macros = await this.macrosRepository.findAll();
    return macros.map(toPublicMacro);
  }

  async update(id: string, dto: UpdateMacroDto): Promise<PublicMacro> {
    await this.getMacroOrThrow(id);
    const sanitizedDto = dto.body !== undefined ? { ...dto, body: sanitizeCommentBody(dto.body) } : dto;
    await this.macrosRepository.update(id, sanitizedDto);
    const updated = await this.getMacroOrThrow(id);
    return toPublicMacro(updated);
  }

  async remove(id: string): Promise<void> {
    await this.getMacroOrThrow(id);
    await this.macrosRepository.delete(id);
  }

  private async getMacroOrThrow(id: string) {
    const macro = await this.macrosRepository.findById(id);
    if (!macro) {
      throw new NotFoundException('Macro not found');
    }
    return macro;
  }
}
