import { AutomationConditionField, AutomationConditionOperator } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, ValidateIf } from 'class-validator';

export class AutomationConditionDto {
  @ApiProperty({ enum: AutomationConditionField })
  @IsEnum(AutomationConditionField)
  field!: AutomationConditionField;

  // Required only when field === CUSTOM_FIELD — enforced in
  // AutomationRulesService, not here, since ValidateIf can't easily express
  // "required" (it can only skip validation, not add it back conditionally
  // without also duplicating the @IsUUID decorator under the same guard).
  @ApiPropertyOptional()
  @ValidateIf((dto) => dto.field === AutomationConditionField.CUSTOM_FIELD)
  @IsUUID()
  fieldId?: string;

  @ApiProperty({ enum: AutomationConditionOperator })
  @IsEnum(AutomationConditionOperator)
  operator!: AutomationConditionOperator;

  @ApiProperty()
  @IsString()
  value!: string;
}
