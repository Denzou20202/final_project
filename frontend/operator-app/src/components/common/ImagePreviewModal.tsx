import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadIcon } from './icons.js';

// The click target for every inline image (chat attachments, embedded
// knowledge-base article images) — `fileName` is only known for actual
// attachments (AttachmentImage), so the download button just doesn't render
// for an article-embedded image that has no attachment record behind it.
export function ImagePreviewModal({
  src,
  alt,
  fileName,
  onClose,
}: {
  src: string;
  alt?: string;
  fileName?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose} role="presentation">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        {fileName && (
          <a
            href={src}
            download={fileName}
            onClick={(e) => e.stopPropagation()}
            title={t('chat.download')}
            aria-label={t('chat.download')}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <DownloadIcon className="h-5 w-5" />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="rounded-full bg-white/10 p-2 text-xl text-white hover:bg-white/20"
        >
          ✕
        </button>
      </div>
      <img
        src={src}
        alt={alt ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
