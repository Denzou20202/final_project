import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTicketCategoryDto {
  @ApiProperty({ example: '1С' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '1С' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameUk?: string;

  @ApiPropertyOptional({ example: '1C' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;
}
