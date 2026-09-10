import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadIcon } from './icons.js';

// Same interaction contract as ImagePreviewModal (Escape / click-outside /
// ✕ all close), plus a real player — a sent screen recording gets watched
// in place, with a download option alongside it.
export function VideoPreviewModal({ src, fileName, onClose }: { src: string; fileName?: string; onClose: () => void }) {
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
      <video
        src={src}
        controls
        autoPlay
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg"
      />
    </div>
  );
}
