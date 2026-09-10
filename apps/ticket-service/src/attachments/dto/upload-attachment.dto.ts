import { IsOptional, IsUUID } from 'class-validator';

// Multer parses the rest of a multipart/form-data body's fields into
// req.body alongside the file — this DTO covers everything except the file
// itself, which arrives via @UploadedFile().
export class UploadAttachmentDto {
  @IsOptional()
  @IsUUID()
  commentId?: string;
}
