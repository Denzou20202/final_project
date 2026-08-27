// Copying a range from Excel/Google Sheets puts BOTH a rendered bitmap
// (image/png) and a real <table> (text/html) on the clipboard at once. Every
// handlePaste here that reacts to a pasted image (screenshot → attachment)
// must check this first — otherwise it grabs the bitmap and preventDefault()s
// the whole paste before ProseMirror/TableKit ever gets a chance to parse
// the accompanying table HTML, degrading a real table into a flat picture.
export function clipboardHasTable(event: ClipboardEvent): boolean {
  const html = event.clipboardData?.getData('text/html');
  return !!html && /<table[\s>]/i.test(html);
}
