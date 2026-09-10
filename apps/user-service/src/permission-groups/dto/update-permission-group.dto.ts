import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { CIDR_REGEX } from './cidr.validator.js';

const MAX_DEPARTMENTS = 100;
const MAX_IP_RANGES = 50;

export class UpdatePermissionGroupDto {
  @ApiPropertyOptional({ example: 'Стажёры 1-й линии' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  restrictToDepartments?: boolean;

  // Full replace, not a diff — absent means "don't touch", present (even
  // []) means "the base department list is now exactly this set".
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DEPARTMENTS)
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  restrictToOwnTickets?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cannotBeAssignee?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireTwoFactor?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['203.0.113.0/24'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IP_RANGES)
  @Matches(CIDR_REGEX, { each: true, message: 'Каждый диапазон должен быть в формате CIDR, например 203.0.113.0/24' })
  ipWhitelist?: string[];
}
