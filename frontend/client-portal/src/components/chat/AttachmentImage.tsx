import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePreviewModal } from '../common/ImagePreviewModal.js';
import { useAttachmentBlobUrl } from '../../hooks/useAttachmentBlobUrl.js';
import type { PublicAttachment } from '../../lib/types.js';

// The file needs an authenticated fetch first (a plain <img src> can't
// carry an Authorization header, and MinIO itself isn't reachable from a
// real browser anyway — see fetchAttachmentBlob), so the thumbnail can't
// render until that resolves into a local blob: URL.
export function AttachmentImage({ attachment }: { attachment: PublicAttachment }) {
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
      <img
        src={url}
        alt={attachment.fileName}
        onClick={() => setShowModal(true)}
        className="max-h-56 max-w-[240px] cursor-pointer rounded-lg object-cover"
      />
      {showModal && (
        <ImagePreviewModal src={url} alt={attachment.fileName} fileName={attachment.fileName} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
