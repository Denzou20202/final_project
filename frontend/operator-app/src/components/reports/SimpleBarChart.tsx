// Hand-rolled instead of pulling in a charting library — this is the only
// chart in the app, and a plain flexbox bar chart covers it without adding
// a new dependency for one view.
export function SimpleBarChart({ data }: { data: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-surface-card text-[13px] text-ink-faint">
        —
      </div>
    );
  }

  return (
    <div className="flex h-40 items-stretch gap-1 overflow-x-auto rounded-lg border border-border bg-surface-card p-3">
      {data.map((d) => (
        <div key={d.key} className="flex min-w-[28px] flex-1 flex-col justify-end gap-1" title={`${d.label}: ${d.value}`}>
          <div
            className="w-full rounded-t bg-brand-600"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
          <span className="w-full truncate text-center text-[10px] text-ink-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
