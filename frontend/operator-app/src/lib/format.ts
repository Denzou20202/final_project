import type { TFunction } from 'i18next';

// Shared by ReportsPage and OperatorReportView — under an hour reads as
// plain minutes, an hour or more switches to a one-decimal hour count.
export function formatMinutes(t: TFunction, value: number | null): string {
  if (value === null) return '—';
  if (value < 60) return t('analytics.minutesShort', { count: value });
  return t('analytics.hoursShort', { count: (value / 60).toFixed(1) });
}

// Single source of truth for "ДД.ММ.ГГГГ, ЧЧ:ММ" — this used to be
// redefined per-file (some missing `year`, producing inconsistent output
// between the audit log, client history, trash, etc.).
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// <input type="date"> hands back a plain "YYYY-MM-DD" with no time or zone
// info. Feeding that straight into `new Date(...)` parses it as UTC
// midnight (a JS quirk specific to date-only strings — date-TIME strings
// parse as local instead), which silently shifts the boundary by the
// browser's UTC offset and, for "to", also stops at the very start of that
// calendar day instead of the end of it. A от-до range must mean the whole
// local day, so build it from local date parts instead of trusting Date's
// default string parsing.
export function startOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function endOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function toLocalDateInputValue(value: string | Date): string {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
