import { ReportGroupBy } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto.js';

const MAX_COLUMNS = 20;

export class RunReportDto {
  @ApiProperty({ enum: ReportGroupBy })
  @IsEnum(ReportGroupBy)
  groupBy!: ReportGroupBy;

  @ApiProperty({ type: ReportFiltersDto })
  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters!: ReportFiltersDto;

  // Also honored by the run/export endpoints (CSV/XML), not just saved
  // reports — restricts which metric columns the export includes, instead
  // of always emitting every one regardless of what's hidden on screen.
  @ApiPropertyOptional({ type: [String], description: 'Видимые колонки результата — отсутствие поля значит «все»' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_COLUMNS)
  @IsString({ each: true })
  columns?: string[];
}
