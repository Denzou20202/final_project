import { SearchIndexQueueModule } from '@veloxdesk/common';
import { TagEntity, TicketTagEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsModule } from '../tickets/tickets.module.js';
import { TagsController } from './tags.controller.js';
import { TagsRepository } from './tags.repository.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TagEntity, TicketTagEntity]), TicketsModule, SearchIndexQueueModule],
  controllers: [TagsController],
  providers: [TagsService, TagsRepository],
})
export class TagsModule {}
