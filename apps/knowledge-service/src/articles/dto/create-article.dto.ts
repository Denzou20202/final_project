import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'Как подключить интеграцию с 1С' })
  @IsString()
  @MinLength(3)
  title!: string;

  // Auto-filled via DeepL as the admin types `title`, editable before save —
  // only the title translates; `content` (the article body) stays admin-
  // language-only by design.
  @ApiPropertyOptional({ example: 'Як підключити інтеграцію з 1С' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleUk?: string;

  @ApiPropertyOptional({ example: 'How to connect the 1C integration' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleEn?: string;

  @ApiProperty({ example: 'Пошаговая инструкция...' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
