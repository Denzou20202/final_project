import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadAttachment } from '../../hooks/useAttachments.js';
import { toIntlLocale } from '../../lib/format.js';
import { isImageFile, isVideoFile } from '../../lib/is-image-file.js';
import type { PublicAttachment } from '../../lib/types.js';
import { AttachmentImage } from './AttachmentImage.js';
import { AttachmentVideo } from './AttachmentVideo.js';

// Images open a preview modal, videos a player modal, everything else is a
// generic download chip.
function MediaOrChip({ attachment }: { attachment: PublicAttachment }) {
  if (isImageFile(attachment.fileName)) return <AttachmentImage attachment={attachment} />;
  if (isVideoFile(attachment.fileName)) return <AttachmentVideo attachment={attachment} />;
  return <FileChip attachment={attachment} />;
}

function formatFileSize(t: TFunction, bytes: number): string {
  if (bytes < 1024) return t('chat.fileSizeBytes', { count: bytes });
  if (bytes < 1024 * 1024) return t('chat.fileSizeKB', { count: (bytes / 1024).toFixed(1) });
  return t('chat.fileSizeMB', { count: (bytes / (1024 * 1024)).toFixed(1) });
}

function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleTimeString(toIntlLocale(language), { hour: '2-digit', minute: '2-digit' });
}

function FileChip({ attachment }: { attachment: PublicAttachment }) {
  const { t, i18n } = useTranslation();
  const [isOpening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      await downloadAttachment(attachment.id, attachment.fileName);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={isOpening}
      className="flex items-center gap-2 rounded-xl border border-border bg-surface-card px-3.5 py-2 text-[12.5px] hover:border-brand-600 disabled:opacity-60"
    >
      <span role="img" aria-label={t('chat.fileAria')}>
        📎
      </span>
      <span className="max-w-[240px] truncate font-medium text-ink">{attachment.fileName}</span>
      <span className="text-ink-faint">{formatFileSize(t, attachment.fileSize)}</span>
      <span className="text-[11px] text-ink-faint">{formatTime(attachment.createdAt, i18n.language)}</span>
    </button>
  );
}

// isMine is null only for attachments uploaded before uploaderId existed (no
// backfill possible for historical rows) — those render as a neutral
// centered card since which side they belong on is genuinely unknown.
// Everything uploaded from here on mirrors MessageBubble's left/right
// alignment exactly, so a file reads the same way a reply from the same
// person would.
export function AttachmentInlineCard({
  attachment,
  isMine,
}: {
  attachment: PublicAttachment;
  isMine: boolean | null;
}) {
  const { t, i18n } = useTranslation();
  const isMedia = isImageFile(attachment.fileName) || isVideoFile(attachment.fileName);

  if (isMine === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <MediaOrChip attachment={attachment} />
        {isMedia && (
          <span className="text-[11px] text-ink-faint">
            {attachment.fileName} · {formatTime(attachment.createdAt, i18n.language)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <MediaOrChip attachment={attachment} />
      <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-ink-faint">
        <span>
          {isMine ? t('chat.you') : t('chat.supportAgent')} · {formatTime(attachment.createdAt, i18n.language)}
        </span>
      </div>
    </div>
  );
}
