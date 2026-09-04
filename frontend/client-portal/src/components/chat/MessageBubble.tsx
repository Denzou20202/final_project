import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadAttachment } from '../../hooks/useAttachments.js';
import { toIntlLocale } from '../../lib/format.js';
import { isImageFile, isVideoFile } from '../../lib/is-image-file.js';
import type { PublicAttachment, PublicComment } from '../../lib/types.js';
import { AttachmentImage } from './AttachmentImage.js';
import { AttachmentVideo } from './AttachmentVideo.js';

function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleTimeString(toIntlLocale(language), { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(t: TFunction, bytes: number): string {
  if (bytes < 1024) return t('chat.fileSizeBytes', { count: bytes });
  if (bytes < 1024 * 1024) return t('chat.fileSizeKB', { count: (bytes / 1024).toFixed(1) });
  return t('chat.fileSizeMB', { count: (bytes / (1024 * 1024)).toFixed(1) });
}

// comment.body is HTML sanitized server-side (see sanitizeCommentBody in
// libs/common) to a small allowlist — safe to render directly.
// break-words (overflow-wrap) matters here: an unbroken run of characters —
// a long URL, a token, or someone leaning on the keyboard — must wrap inside
// the bubble's max-width instead of blowing the whole thread out sideways.
// overflow-x-auto is for a table specifically — table-fixed columns don't
// shrink to fit the bubble's max-w-[70%], so a wide table scrolls inside
// its own box instead of blowing out the whole thread (same pattern already
// used for oversized tables elsewhere in the app).
const RICH_TEXT_CLASSNAME =
  "whitespace-pre-wrap break-words overflow-x-auto [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-ink/10 [&_code]:px-1 [&_code]:py-0.5 [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_[data-type='mention']]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_td]:border-current/30 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:border-current/30 [&_th]:bg-ink/5 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold";

function AttachmentChips({
  attachments,
  isMine,
  hasText,
}: {
  attachments: PublicAttachment[];
  isMine: boolean;
  hasText: boolean;
}) {
  const { t } = useTranslation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function handleDownload(id: string, fileName: string) {
    setDownloadingId(id);
    try {
      await downloadAttachment(id, fileName);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${hasText ? 'mt-1.5' : ''}`}>
      {attachments.map((attachment) =>
        isImageFile(attachment.fileName) ? (
          <AttachmentImage key={attachment.id} attachment={attachment} />
        ) : isVideoFile(attachment.fileName) ? (
          <AttachmentVideo key={attachment.id} attachment={attachment} />
        ) : (
          <button
            key={attachment.id}
            type="button"
            onClick={() => handleDownload(attachment.id, attachment.fileName)}
            disabled={downloadingId === attachment.id}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] disabled:opacity-60 ${
              isMine ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-surface-muted text-ink hover:bg-surface-muted/70'
            }`}
          >
            <span role="img" aria-label={t('chat.fileAria')}>
              📎
            </span>
            <span className="min-w-0 truncate font-medium">{attachment.fileName}</span>
            <span className={isMine ? 'text-white/70' : 'text-ink-faint'}>{formatFileSize(t, attachment.fileSize)}</span>
          </button>
        ),
      )}
    </div>
  );
}

export function MessageBubble({
  comment,
  attachments,
  isMine,
  onEdit,
  editDisabled,
}: {
  comment: PublicComment;
  attachments: PublicAttachment[];
  isMine: boolean;
  onEdit: () => void;
  // A send is in flight for a different message — loading this one into the
  // shared composer editor while that resolves would collide with its
  // post-await clearContent()/setStagedFiles. See ChatPanel's startEditing.
  editDisabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const hasText = comment.body.trim().length > 0;

  return (
    <div className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-[13.5px] ${
          isMine ? 'bg-brand-600 text-white' : 'bg-surface-card text-ink'
        }`}
      >
        {hasText && (
          <div className={RICH_TEXT_CLASSNAME} dangerouslySetInnerHTML={{ __html: comment.body }} />
        )}
        <AttachmentChips attachments={attachments} isMine={isMine} hasText={hasText} />
      </div>
      <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-ink-faint">
        <span>
          {isMine ? t('chat.you') : t('chat.supportAgent')} · {formatTime(comment.createdAt, i18n.language)}
          {comment.editedAt && <span className="italic"> · {t('chat.edited')}</span>}
        </span>
        {isMine && (
          <button
            type="button"
            onClick={onEdit}
            disabled={editDisabled}
            className="invisible font-medium text-brand-600 hover:underline group-hover:visible disabled:opacity-50 disabled:hover:no-underline"
          >
            {t('chat.edit')}
          </button>
        )}
      </div>
    </div>
  );
}
