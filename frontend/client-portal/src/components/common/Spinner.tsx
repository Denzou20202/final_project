// Same pure-CSS recipe as operator-app's PageLoading (no SVG/library) —
// ported here since client-portal had no spinner of its own before this.
export function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-border border-t-brand-600 ${className}`} />;
}
