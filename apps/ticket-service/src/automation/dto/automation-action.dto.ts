import { AutomationActionType } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

// Deliberately permissive at the DTO level — which of value/fieldId/formula
// is actually required depends on `type` (e.g. SET_CUSTOM_FIELD needs
// fieldId + exactly one of value/formula; SET_STATUS just needs value).
// AutomationRulesService validates that coherence and existence of any
// referenced ids (team/user/field), where it can also produce a clear
// BadRequestException message per action rather than a generic decorator error.
export class AutomationActionDto {
  @ApiProperty({ enum: AutomationActionType })
  @IsEnum(AutomationActionType)
  type!: AutomationActionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formula?: string;
}
