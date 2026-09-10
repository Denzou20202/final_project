import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMacroDto {
  @ApiProperty({ example: 'Просьба перезагрузить устройство' })
  @IsString()
  @MinLength(2)
  title!: string;

  // Auto-filled via DeepL as the admin types `title`, editable before save —
  // only the title translates; `body` (the actual canned-response text)
  // stays admin-language-only by design.
  @ApiPropertyOptional({ example: 'Прохання перезавантажити пристрій' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleUk?: string;

  @ApiPropertyOptional({ example: 'Please restart the device' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleEn?: string;

  @ApiProperty({ example: 'Пожалуйста, перезагрузите устройство и сообщите, сохранилась ли проблема.' })
  @IsString()
  @MinLength(1)
  body!: string;
}
