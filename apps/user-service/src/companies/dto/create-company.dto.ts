import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'ПрАТ "Ромашка"' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}
