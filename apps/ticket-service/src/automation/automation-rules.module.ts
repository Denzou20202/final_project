import { AutomationTriggerQueueModule, SettingsAuditLogModule } from '@veloxdesk/common';
import { AutomationRuleEntity, MacroEntity, TeamEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { TicketStatusesModule } from '../ticket-statuses/ticket-statuses.module.js';
import { AutomationRulesController } from './automation-rules.controller.js';
import { AutomationRulesRepository } from './automation-rules.repository.js';
import { AutomationRulesService } from './automation-rules.service.js';
import { AutomationTriggerProcessor } from './automation-trigger.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationRuleEntity, TeamEntity, UserEntity, MacroEntity]),
    CustomFieldsModule,
    TicketsModule,
    TicketStatusesModule,
    // Registers the BullMQ queue itself — required both for the producer
    // (unused here; the producer is injected directly in TicketsModule) and
    // for AutomationTriggerProcessor below to attach as a worker.
    AutomationTriggerQueueModule,
    SettingsAuditLogModule,
  ],
  controllers: [AutomationRulesController],
  providers: [AutomationRulesService, AutomationRulesRepository, AutomationTriggerProcessor],
})
export class AutomationRulesModule {}
