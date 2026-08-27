import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class ReportPeriodQueryDto {
  @ApiPropertyOptional({ description: 'Defaults to 30 days before `to`', example: '2026-06-13T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Defaults to now', example: '2026-07-13T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
