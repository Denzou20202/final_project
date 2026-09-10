import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VideoPreviewModal } from '../common/VideoPreviewModal.js';
import { useAttachmentBlobUrl } from '../../hooks/useAttachmentBlobUrl.js';
import type { PublicAttachment } from '../../lib/types.js';

// Mirrors AttachmentImage's authenticated-blob flow (a plain <video src>
// can't carry an Authorization header, and MinIO isn't reachable from a
// real browser anyway — see fetchAttachmentBlob). The inline element shows
// the first frame as a muted thumbnail with a play badge; the actual
// watching happens in the modal, same as screenshots.
export function AttachmentVideo({ attachment }: { attachment: PublicAttachment }) {
  const { t } = useTranslation();
  const { url, failed, retry } = useAttachmentBlobUrl(attachment.id);
  const [showModal, setShowModal] = useState(false);

  if (failed) {
    return (
      <button
        type="button"
        onClick={retry}
        className="flex h-32 w-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface-muted text-[12px] text-ink-subtle hover:border-brand-600 hover:text-brand-600"
      >
        <span>{t('chat.loadFailed')}</span>
        <span className="font-semibold underline">{t('chat.retry')}</span>
      </button>
    );
  }

  if (!url) {
    return <div className="h-32 w-48 animate-pulse rounded-lg bg-surface-muted" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        aria-label={t('chat.watchVideoAria', { name: attachment.fileName })}
        className="relative block cursor-pointer"
      >
        <video src={url} preload="metadata" muted playsInline className="max-h-56 max-w-[240px] rounded-lg" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 pl-0.5 text-lg text-white">
            ▶
          </span>
        </span>
      </button>
      {showModal && <VideoPreviewModal src={url} fileName={attachment.fileName} onClose={() => setShowModal(false)} />}
    </>
  );
}
