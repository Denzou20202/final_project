import { useEffect, useState } from 'react';
import { fetchAttachmentBlob } from '../lib/api/attachments.api.js';

// Shared by AttachmentImage/AttachmentVideo — both need the same
// authenticated-fetch-then-blob-URL dance, and both used to have no error
// path at all: a failed fetch (e.g. a 429 from nginx's rate limit under a
// burst of parallel requests) left them stuck on the loading placeholder
// forever, with no way to recover short of a full page reload. `retry`
// bumps a counter that's in the effect's dependency array, forcing a fresh
// attempt without needing a key-based remount from the parent.
export function useAttachmentBlobUrl(attachmentId: string): { url: string | null; failed: boolean; retry: () => void } {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setFailed(false);

    fetchAttachmentBlob(attachmentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, attempt]);

  return {
    url,
    failed,
    retry: () => {
      setUrl(null);
      setAttempt((n) => n + 1);
    },
  };
}
