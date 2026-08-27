import { SettingsAuditLogModule } from '@veloxdesk/common';
import { AttachmentEntity, CustomFieldDefinitionEntity, TicketCustomFieldValueEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsModule } from '../tickets/tickets.module.js';
import { CustomFieldsController } from './custom-fields.controller.js';
import { CustomFieldsRepository } from './custom-fields.repository.js';
import { CustomFieldsService } from './custom-fields.service.js';
import { TicketCustomFieldValuesController } from './ticket-custom-field-values.controller.js';
import { TicketCustomFieldValuesRepository } from './ticket-custom-field-values.repository.js';

@Module({
  imports: [
    // AttachmentEntity: FILE-type custom fields store an attachment id as
    // their value — CustomFieldsService looks it up directly to confirm it
    // belongs to the same ticket, rather than depending on AttachmentsModule
    // (which itself depends on TicketsModule already imported below).
    TypeOrmModule.forFeature([CustomFieldDefinitionEntity, TicketCustomFieldValueEntity, AttachmentEntity]),
    TicketsModule,
    SettingsAuditLogModule,
  ],
  controllers: [CustomFieldsController, TicketCustomFieldValuesController],
  providers: [CustomFieldsService, CustomFieldsRepository, TicketCustomFieldValuesRepository],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
