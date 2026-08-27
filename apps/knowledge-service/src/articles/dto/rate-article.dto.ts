import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RateArticleDto {
  @ApiProperty()
  @IsBoolean()
  helpful!: boolean;
}
