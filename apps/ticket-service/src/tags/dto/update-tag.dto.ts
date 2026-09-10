import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTagDto {
  @ApiProperty({ example: 'VIP' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  // Auto-filled via DeepL as the admin types `name`, editable before save.
  // Only ever reachable through this rename flow — tags auto-created inline
  // on a ticket (addToTicket) get no translation, by design.
  @ApiPropertyOptional({ example: 'VIP' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameUk?: string;

  @ApiPropertyOptional({ example: 'VIP' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;
}
