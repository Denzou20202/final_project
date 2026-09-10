import { CustomFieldType } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCustomFieldDefinitionDto {
  @ApiProperty({ example: 'Номер договора' })
  @IsString()
  @MinLength(1)
  label!: string;

  // Auto-filled via DeepL as the admin types `label`, editable before save —
  // only the label translates, options/optionsByParent below stay admin-
  // language-only by design.
  @ApiPropertyOptional({ example: 'Номер договору' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  labelUk?: string;

  @ApiPropertyOptional({ example: 'Contract number' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  labelEn?: string;

  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  fieldType!: CustomFieldType;

  // Only meaningful (and required) when fieldType is SELECT — the fixed
  // list of choices an operator can pick from. Ignored (not required) for a
  // SELECT field that gets its options from optionsByParent instead.
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((dto) => dto.fieldType === CustomFieldType.SELECT && !dto.optionsByParent)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];

  // REGEX fields only — required there, checked for actually compiling as a
  // RegExp in CustomFieldsService (a syntax error is a 400 at save time, not
  // a runtime surprise the first time someone types into the field).
  @ApiPropertyOptional({ example: '^\\+?[0-9\\s\\-()]{7,20}$' })
  @ValidateIf((dto) => dto.fieldType === CustomFieldType.REGEX)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  pattern?: string;

  // The single field this one depends on — backs both conditionValue
  // (visibility) and optionsByParent (hierarchical options) below. Either,
  // both, or neither of those may be set once this is.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dependsOnFieldId?: string;

  // Optional even when dependsOnFieldId is set — a field can depend on
  // another purely for optionsByParent (hierarchical options) without any
  // visibility condition at all.
  @ApiPropertyOptional({ description: 'Show this field only when dependsOnFieldId equals this value' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  conditionValue?: string;

  // Only meaningful when this field AND dependsOnField are both SELECT —
  // maps the parent's option to this field's own option list.
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } })
  @IsOptional()
  @IsObject()
  optionsByParent?: Record<string, string[]>;
}
