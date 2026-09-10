import { UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';

// Only UserEntity needs a forFeature repository here — the merge
// transaction reaches TicketEntity/CommentEntity/etc. through the injected
// DataSource's EntityManager directly (see ContactsService.merge), which
// works against any entity already registered on the shared DataSource
// without a local forFeature import (same pattern TicketsService.merge()
// uses for AttachmentEntity).
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
