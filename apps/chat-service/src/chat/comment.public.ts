import { CommentEntity } from '@veloxdesk/database';

export interface PublicComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  editedAt: Date | null;
}

export function toPublicComment(comment: CommentEntity): PublicComment {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorId: comment.authorId,
    body: comment.body,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt ?? null,
  };
}
