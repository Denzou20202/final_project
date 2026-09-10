// Block-level closers become newlines first: textContent alone would glue
// «<p>Первое</p><p>Второе</p>» into «ПервоеВторое».
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n');
  const div = document.createElement('div');
  div.innerHTML = withBreaks;
  return (div.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
