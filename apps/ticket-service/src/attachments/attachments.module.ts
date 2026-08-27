import { AttachmentEntity, CommentEntity, UserEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsModule } from '../tickets/tickets.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { S3Module } from './s3.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([AttachmentEntity, CommentEntity, UserEntity]), TicketsModule, S3Module],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
