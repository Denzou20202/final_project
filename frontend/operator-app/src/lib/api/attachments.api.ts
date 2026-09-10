import { ticketApi } from './client.js';
import type { PublicAttachment } from '../types.js';

export async function uploadAttachment(ticketId: string, file: File, commentId?: string): Promise<PublicAttachment> {
  const form = new FormData();
  form.append('file', file);
  if (commentId) form.append('commentId', commentId);
  const { data } = await ticketApi.post<PublicAttachment>(`/tickets/${ticketId}/attachments`, form);
  return data;
}

export async function listAttachments(ticketId: string): Promise<PublicAttachment[]> {
  const { data } = await ticketApi.get<PublicAttachment[]>(`/tickets/${ticketId}/attachments`);
  return data;
}

// Raw bytes, not a redirect URL — the backend can't hand back a presigned
// MinIO link (S3_ENDPOINT is the Docker-internal "minio:9000", unreachable
// from a real browser), so this is an authenticated fetch of the actual
// file content. Callers turn it into a blob: URL via URL.createObjectURL —
// forced download vs. inline display is decided by how that URL gets used,
// not by anything the server sets.
export async function fetchAttachmentBlob(id: string): Promise<Blob> {
  const { data } = await ticketApi.get<Blob>(`/attachments/${id}/download`, { responseType: 'blob' });
  return data;
}
