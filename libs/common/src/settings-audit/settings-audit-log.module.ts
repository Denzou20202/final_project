import { SettingsAuditLogEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsAuditLogService } from './settings-audit-log.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SettingsAuditLogEntity])],
  providers: [SettingsAuditLogService],
  exports: [SettingsAuditLogService],
})
export class SettingsAuditLogModule {}
