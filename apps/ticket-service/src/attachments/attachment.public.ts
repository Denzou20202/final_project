import { AttachmentEntity } from '@veloxdesk/database';

export interface PublicAttachment {
  id: string;
  ticketId: string;
  uploaderId: string | null;
  commentId: string | null;
  fileName: string;
  fileSize: number;
  createdAt: Date;
}

export function toPublicAttachment(attachment: AttachmentEntity): PublicAttachment {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    uploaderId: attachment.uploaderId,
    commentId: attachment.commentId,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    createdAt: attachment.createdAt,
  };
}
