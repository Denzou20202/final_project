import { create } from 'zustand';

// A message with attachments where the text/comment landed but one or more
// files failed to upload — file(s) staged here so the failure survives
// ChatPanel's own remount (TicketDetailPage mounts it with
// `key={ticket.id}`, deliberately wiping ChatPanel's local state on every
// ticket switch). Without this, navigating away before retrying used to
// destroy the failed-upload state with zero trace: the comment (already
// sent) permanently has fewer attachments than intended, and nothing ever
// tells the operator. Keeping it here means returning to the ticket later
// still shows the retry banner instead of silently losing it. Not
// persisted (zustand/middleware's persist round-trips through JSON, which
// can't carry real File objects) — surviving a full page reload isn't the
// goal, only surviving in-app navigation between tickets.
interface PendingRetry {
  commentId: string;
  files: File[];
}

interface AttachmentRetryState {
  pending: Record<string, PendingRetry>;
  setPending: (ticketId: string, retry: PendingRetry) => void;
  clearPending: (ticketId: string) => void;
}

export const useAttachmentRetryStore = create<AttachmentRetryState>()((set) => ({
  pending: {},
  setPending: (ticketId, retry) => set((state) => ({ pending: { ...state.pending, [ticketId]: retry } })),
  clearPending: (ticketId) =>
    set((state) => {
      if (!(ticketId in state.pending)) return state;
      const pending = { ...state.pending };
      delete pending[ticketId];
      return { pending };
    }),
}));
