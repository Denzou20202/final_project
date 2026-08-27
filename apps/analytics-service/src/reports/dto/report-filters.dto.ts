import { ReportDateField, ReportPeriodBucket, TicketPriority } from '@veloxdesk/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const MAX_FILTER_VALUES = 20;

export class ReportFiltersDto {
  @ApiPropertyOptional({ description: 'ticket_statuses row ids', isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsUUID('4', { each: true })
  statusIds?: string[];

  @ApiPropertyOptional({ enum: TicketPriority, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsEnum(TicketPriority, { each: true })
  priorities?: TicketPriority[];

  @ApiPropertyOptional({ description: 'ticket_types row ids', isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsUUID('4', { each: true })
  typeIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  // Free text, not a UUID — see UserEntity.company (was `subdivision`); no
  // relational Company entity exists yet.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Custom field definition id — must be paired with customFieldValue' })
  @IsOptional()
  @IsUUID()
  customFieldId?: string;

  @ApiPropertyOptional({ description: 'Exact value to match on the custom field — must be paired with customFieldId' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customFieldValue?: string;

  // Truly optional to match the Swagger doc's own "default" claim —
  // dateColumnsFor's switch (reports.repository.ts) already falls back to
  // CREATED for undefined, so omitting this must not 400.
  @ApiPropertyOptional({ enum: ReportDateField, default: ReportDateField.CREATED })
  @IsOptional()
  @IsEnum(ReportDateField)
  dateField?: ReportDateField;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  // Only meaningful when groupBy is PERIOD (reports.repository.ts defaults
  // to DAY when omitted) — ignored for every other groupBy.
  @ApiPropertyOptional({ enum: ReportPeriodBucket, default: ReportPeriodBucket.DAY })
  @IsOptional()
  @IsEnum(ReportPeriodBucket)
  periodBucket?: ReportPeriodBucket;
}
