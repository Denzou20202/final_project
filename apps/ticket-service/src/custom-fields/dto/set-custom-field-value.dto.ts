import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetCustomFieldValueDto {
  // Empty string clears the value (the row is deleted rather than kept
  // with an empty value) — see CustomFieldsService.setValue.
  @ApiProperty()
  @IsString()
  value!: string;
}
