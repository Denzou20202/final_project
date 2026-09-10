import { TicketEntity, TicketTypeEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketTypesController } from './ticket-types.controller.js';
import { TicketTypesRepository } from './ticket-types.repository.js';
import { TicketTypesService } from './ticket-types.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TicketTypeEntity, TicketEntity])],
  controllers: [TicketTypesController],
  providers: [TicketTypesService, TicketTypesRepository],
  exports: [TicketTypesService, TicketTypesRepository],
})
export class TicketTypesModule {}
