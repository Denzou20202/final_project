import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';

export class AuditReportQueryDto {
  @ApiProperty({ enum: ['type', 'actor'] })
  @IsIn(['type', 'actor'])
  groupBy!: 'type' | 'actor';

  @ApiProperty()
  @IsDateString()
  from!: string;

  @ApiProperty()
  @IsDateString()
  to!: string;
}
