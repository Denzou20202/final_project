import { SettingsAuditEventType, SettingsAuditModule } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class SettingsAuditQueryDto {
  @ApiProperty()
  @IsDateString()
  from!: string;

  @ApiProperty()
  @IsDateString()
  to!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ enum: SettingsAuditModule })
  @IsOptional()
  @IsEnum(SettingsAuditModule)
  module?: SettingsAuditModule;

  @ApiPropertyOptional({ enum: SettingsAuditEventType })
  @IsOptional()
  @IsEnum(SettingsAuditEventType)
  eventType?: SettingsAuditEventType;
}
