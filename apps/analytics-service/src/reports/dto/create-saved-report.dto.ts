import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { RunReportDto } from './run-report.dto.js';

// `columns` is already on the base RunReportDto (needed there too, for
// run/export CSV/XML) — nothing extra to add here beyond the name.
export class CreateSavedReportDto extends RunReportDto {
  @ApiProperty({ example: 'Загрузка операторов за месяц' })
  @IsString()
  @MinLength(2)
  name!: string;
}
