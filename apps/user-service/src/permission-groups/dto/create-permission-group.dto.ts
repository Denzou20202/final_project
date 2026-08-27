import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { CIDR_REGEX } from './cidr.validator.js';

const MAX_DEPARTMENTS = 100;
const MAX_IP_RANGES = 50;

export class CreatePermissionGroupDto {
  @ApiProperty({ example: 'Стажёры 1-й линии' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  restrictToDepartments?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Id отделов — базовый список группы' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DEPARTMENTS)
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  restrictToOwnTickets?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Роль «наблюдатель» — нельзя назначать исполнителем' })
  @IsOptional()
  @IsBoolean()
  cannotBeAssignee?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireTwoFactor?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['203.0.113.0/24'], description: 'Пусто = вход не ограничен по IP' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IP_RANGES)
  @Matches(CIDR_REGEX, { each: true, message: 'Каждый диапазон должен быть в формате CIDR, например 203.0.113.0/24' })
  ipWhitelist?: string[];
}
