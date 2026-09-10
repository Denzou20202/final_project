import { TicketEntity, TicketStatusEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketStatusesController } from './ticket-statuses.controller.js';
import { TicketStatusesRepository } from './ticket-statuses.repository.js';
import { TicketStatusesService } from './ticket-statuses.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TicketStatusEntity, TicketEntity])],
  controllers: [TicketStatusesController],
  providers: [TicketStatusesService, TicketStatusesRepository],
  exports: [TicketStatusesService, TicketStatusesRepository],
})
export class TicketStatusesModule {}
