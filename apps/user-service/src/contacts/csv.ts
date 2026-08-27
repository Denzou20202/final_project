// Mirrors apps/analytics-service/src/reports/csv.ts — kept as a local copy
// rather than a shared lib since that's the established pattern for this
// project's hand-rolled export serializers (see also that service's xml.ts).
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  return '﻿' + lines.join('\r\n');
}
