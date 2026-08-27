// Minimal RFC 4180 quoting — not worth pulling in a dependency for this.
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Excel/Sheets formula-injection guard: a user-controlled string (ticket
  // title, a client's name) starting with = + - @ would execute as a
  // formula on open. Prefixing an apostrophe makes spreadsheet apps treat
  // it as literal text. Only strings — numeric fields can't carry payloads
  // and a leading apostrophe would corrupt negative numbers.
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
  // Excel (macOS and Windows alike) doesn't assume UTF-8 for a bare .csv —
  // without a BOM it guesses a legacy 8-bit encoding and every Cyrillic
  // header/cell turns into mojibake the instant the file is opened.
  return '﻿' + lines.join('\r\n');
}
