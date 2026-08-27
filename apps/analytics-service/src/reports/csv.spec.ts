import { toCsv } from './csv.js';

const BOM = '﻿';

describe('toCsv', () => {
  it('prefixes a UTF-8 BOM so Excel decodes Cyrillic correctly', () => {
    const csv = toCsv(['Оператор'], [['Иванов']]);
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it('joins rows with CRLF and fields with commas', () => {
    const csv = toCsv(['a', 'b'], [[1, 2], [3, 4]]);
    expect(csv).toBe(`${BOM}a,b\r\n1,2\r\n3,4`);
  });

  it('quotes fields containing commas, quotes and newlines', () => {
    const csv = toCsv(['h'], [['a,b'], ['say "hi"'], ['line1\nline2'], ['cr\rhere']]);
    expect(csv).toBe(`${BOM}h\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"\r\n"cr\rhere"`);
  });

  it('renders null/undefined as empty fields', () => {
    const csv = toCsv(['h'], [[null], [undefined]]);
    expect(csv).toBe(`${BOM}h\r\n\r\n`);
  });

  it('neutralizes spreadsheet formula injection in string fields', () => {
    const csv = toCsv(['h'], [['=HYPERLINK("https://evil")'], ['+1', '@cmd', '-x']]);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).toContain(`'+1`);
    expect(csv).toContain(`'@cmd`);
    expect(csv).toContain(`'-x`);
  });

  it('leaves negative numbers untouched', () => {
    const csv = toCsv(['h'], [[-5]]);
    expect(csv).toBe(`${BOM}h\r\n-5`);
  });
});
