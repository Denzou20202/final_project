// Minimal XML serializer, same "not worth a dependency for this" philosophy
// as csv.ts. Headers (e.g. "% SLA", "Ср. первый ответ (мин)") aren't valid
// XML element names — spaces/%/parens aren't allowed in a Name — so each
// cell is a generic <field name="..."> rather than a header-derived tag.
function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toXml(headers: string[], rows: unknown[][]): string {
  const rowsXml = rows
    .map((row) => {
      const fields = row
        .map((value, i) => `    <field name="${escapeXml(headers[i])}">${escapeXml(value)}</field>`)
        .join('\n');
      return `  <row>\n${fields}\n  </row>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<report>\n${rowsXml}\n</report>\n`;
}
