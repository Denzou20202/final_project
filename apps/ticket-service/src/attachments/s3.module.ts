import { Module } from '@nestjs/common';
import { S3Service } from './s3.service.js';

// Split out of AttachmentsModule so TicketsService can also inject S3Service
// (to clean up objects on hard-delete) without a circular module dependency —
// AttachmentsModule already imports TicketsModule.
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
