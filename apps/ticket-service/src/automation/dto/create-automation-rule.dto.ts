import { AutomationTrigger } from '@veloxdesk/types';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { AutomationActionDto } from './automation-action.dto.js';
import { AutomationConditionDto } from './automation-condition.dto.js';

// Bounded array sizes — a rule editor gone wrong (or a malicious client)
// shouldn't be able to store an unbounded jsonb blob that then has to be
// evaluated on every single trigger firing.
const MAX_CONDITIONS = 20;
const MAX_ACTIONS = 20;

export class CreateAutomationRuleDto {
  @ApiProperty({ example: 'Срочные тикеты в отдел VIP' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: AutomationTrigger })
  @IsEnum(AutomationTrigger)
  trigger!: AutomationTrigger;

  @ApiPropertyOptional({ type: [AutomationConditionDto] })
  @IsArray()
  @ArrayMaxSize(MAX_CONDITIONS)
  @ValidateNested({ each: true })
  @Type(() => AutomationConditionDto)
  @IsOptional()
  conditions?: AutomationConditionDto[];

  @ApiProperty({ type: [AutomationActionDto] })
  @IsArray()
  @ArrayMaxSize(MAX_ACTIONS)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions!: AutomationActionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
