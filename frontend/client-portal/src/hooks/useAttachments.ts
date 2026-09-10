import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAttachmentBlob, listAttachments, uploadAttachment } from '../lib/api/attachments.api.js';

export function useAttachments(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket', ticketId, 'attachments'],
    queryFn: () => listAttachments(ticketId as string),
    enabled: !!ticketId,
  });
}

export function useUploadAttachment(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, commentId }: { file: File; commentId?: string }) => uploadAttachment(ticketId, file, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'activity'] });
    },
  });
}

// The file needs an authenticated fetch first (a plain <a href> can't carry
// the Authorization header), so the blob: URL only exists after an async
// call. A synthetic <a download> click isn't gated by popup blockers the
// way window.open() is (it never opens a new window/tab), so it works fine
// after an await. `download` with the real file name is what makes this an
// actual save-to-disk instead of just opening the file in the current tab
// (which for a PDF/image would otherwise just navigate away from the ticket).
export async function downloadAttachment(id: string, fileName: string): Promise<void> {
  const blob = await fetchAttachmentBlob(id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
