import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCityDto {
  @ApiProperty({ example: 'Киев' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}
