import { TicketCategoryEntity, TicketEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketCategoriesController } from './ticket-categories.controller.js';
import { TicketCategoriesRepository } from './ticket-categories.repository.js';
import { TicketCategoriesService } from './ticket-categories.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TicketCategoryEntity, TicketEntity])],
  controllers: [TicketCategoriesController],
  providers: [TicketCategoriesService, TicketCategoriesRepository],
  exports: [TicketCategoriesRepository],
})
export class TicketCategoriesModule {}
