import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class TranslateDto {
  // 500 is generous — this only ever carries a name/title/label from one of
  // the 8 admin catalogs, never a body/content field.
  @ApiProperty({ example: 'На согласовании' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}
