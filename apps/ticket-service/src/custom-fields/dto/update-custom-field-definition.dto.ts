import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// Only label/options/pattern/dependency fields are editable after creation —
// changing fieldType on a field that already has values would make those
// values unparseable, so that's intentionally not allowed (delete and
// recreate instead).
export class UpdateCustomFieldDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  pattern?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dependsOnFieldId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  conditionValue?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } })
  @IsOptional()
  @IsObject()
  optionsByParent?: Record<string, string[]>;
}
