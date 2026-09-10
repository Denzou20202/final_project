import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getChatSocket } from '../../lib/socket.js';

// One shared reply into every selected ticket — each send goes through the
// same socket path as a normal chat message (chat-service applies the same
// sanitizing/permission/closed-ticket rules per ticket), so a ticket that
// can't accept a message (e.g. already «Завершено») fails individually
// without blocking the rest.
export function BulkReplyModal({
  ticketIds,
  onDone,
  onClose,
}: {
  ticketIds: string[];
  onDone: (summary: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isSending, setSending] = useState(false);

  async function handleSend() {
    const body = text.trim();
    if (!body || isSending) return;
    setSending(true);

    const results = await Promise.allSettled(
      ticketIds.map(
        (ticketId) =>
          new Promise<void>((resolve, reject) => {
            getChatSocket()
              .timeout(10000)
              .emit(
                'ticket:message',
                { ticketId, body: `<p>${escapeHtml(body)}</p>` },
                // Same ack shape as useChatRoom's sendMessage: the gateway
                // acks `{ error: true, message }` (not a real comment) for a
                // ticket that rejected the send (closed/trashed/no longer a
                // participant) — that's a truthy, non-empty object, so a bare
                // `!ack` check here previously treated every one of these as
                // a success. Must check the shape, not just presence.
                (err: Error | null, ack: { error?: true; message?: string } | null) => {
                  if (err) reject(err);
                  else if (!ack || ack.error) reject(err ?? new Error(ack?.message ?? 'no ack'));
                  else resolve();
                },
              );
          }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    onDone(
      failed === 0
        ? t('ticketModals.repliedAll', { count: ticketIds.length })
        : t('ticketModals.repliedPartial', { done: ticketIds.length - failed, total: ticketIds.length, failed }),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-1 font-display text-base font-bold">{t('ticketModals.replyTitle')}</h2>
        <p className="mb-4 text-[12.5px] text-ink-subtle">
          {t('ticketModals.replySubtitle', { count: ticketIds.length })}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          autoFocus
          placeholder={t('ticketModals.replyPlaceholder')}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!text.trim() || isSending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {isSending ? t('chat.sending') : t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

// The composer normally produces Tiptap HTML; a bulk reply is plain text
// from a textarea, so escape it before wrapping in a paragraph — otherwise
// someone pasting "<b>..." would inject markup (the server would sanitize
// dangerous tags anyway, but escaping keeps the text exactly as typed).
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .join('<br>');
}
