import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const MAX_MEMBERS = 200;

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: 'Техническая поддержка' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Технічна підтримка' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameUk?: string;

  @ApiPropertyOptional({ example: 'Technical support' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  // Full replace, not a diff — absent means "don't touch membership",
  // present (even []) means "membership is now exactly this set".
  @ApiPropertyOptional({ type: [String], description: 'Id операторов/админов, входящих в отдел' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MEMBERS)
  @IsUUID('4', { each: true })
  memberIds?: string[];
}
