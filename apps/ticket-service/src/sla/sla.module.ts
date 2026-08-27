import { SettingsAuditLogModule } from '@veloxdesk/common';
import { SlaPolicyEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaPoliciesController } from './sla-policies.controller.js';
import { SlaPoliciesRepository } from './sla-policies.repository.js';
import { SlaPoliciesService } from './sla-policies.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SlaPolicyEntity]), SettingsAuditLogModule],
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService, SlaPoliciesRepository],
  exports: [SlaPoliciesRepository],
})
export class SlaModule {}
