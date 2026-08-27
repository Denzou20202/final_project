// Suspense fallback for lazy-loaded routes/settings-and-reports sections —
// deliberately translation-free (no useTranslation call) so it never itself
// waits on anything; it's only ever on screen for the brief window a lazy
// chunk takes to download, typically imperceptible after the first visit
// since the browser caches the chunk.
export function PageLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center py-16">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand-600" />
    </div>
  );
}
