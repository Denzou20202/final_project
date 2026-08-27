// Shared between the controller (NestJS's FileTypeValidator, which sniffs
// magic numbers) and the service layer (which independently re-checks the
// CLIENT-DECLARED mimetype against this same allowlist before it's ever
// persisted/served — see AttachmentsService.upload's own comment for why
// that second check exists). Also reused by telegram-ingestion.service.ts,
// which has no multipart form at all and so never goes through the
// validator above — it has to run the identical check itself.

// Video: mp4/webm cover practically every screen recorder and Android;
// quicktime (.mov) is what an iPhone shoots; x-m4v is Apple's mp4 variant.
// All four have real magic-number signatures (ftyp box / EBML), so they go
// through the strict sniffing path, not the mimetype fallback. RAR: both
// RAR4/RAR5 signatures are detected by the file-type package (the same one
// FileTypeValidator uses) as application/x-rar-compressed — that's the one
// string that actually gets produced by magic-number sniffing; vnd.rar is
// included too since some browsers report that as the client-declared
// mimetype instead, which matters for the fallback path.
export const ALLOWED_MIME_TYPES =
  /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|quicktime|x-m4v)|application\/(pdf|zip|x-rar-compressed|vnd\.rar|msword|vnd\.openxmlformats-officedocument\..+)|text\/(plain|csv))$/;

export const ATTACHMENT_MAX_SIZE_BYTES = 35 * 1024 * 1024;

// A file's declared Content-Type and its actual sniffed bytes are two
// independent, decoupled values in NestJS's FileTypeValidator: when magic-
// number sniffing succeeds, it only checks the SNIFFED type against
// ALLOWED_MIME_TYPES and never cross-checks the client-declared mimetype at
// all — so a file with genuine PNG bytes but a declared type of "text/html"
// still passes validation. Whatever gets stored/served as the S3 object's
// ContentType must never be that unchecked declared value verbatim, or a
// browser rendering the download inline (no Content-Disposition, or a
// future consumer that doesn't force-download) executes it as HTML. This
// re-checks the declared type against the SAME allowlist independently of
// whatever the validator decided, and downgrades to a generic, inert type
// otherwise — never rejects here, since the underlying file may be entirely
// legitimate even when its declared header is wrong/absent/lying.
export function safeStoredContentType(declaredMimeType: string): string {
  return ALLOWED_MIME_TYPES.test(declaredMimeType) ? declaredMimeType : 'application/octet-stream';
}

// S3's own API treats a key as an opaque string, but MinIO's filesystem
// backend still walks it as a path — a client-supplied original filename
// containing "/" or ".." could otherwise land the object outside the
// intended `${ticketId}/` prefix. Only used to build the STORAGE KEY, never
// the user-facing `fileName` column/display value — this strips characters
// that matter for a filesystem path, not ones that matter for display (the
// original, including non-ASCII, is kept for that — see the mojibake fix in
// attachments.controller.ts).
export function sanitizeAttachmentFileName(originalName: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping C0 controls, not matching them by accident
  const stripped = originalName.replace(/[/\\]/g, '_').replace(/\.\./g, '_').replace(/[\x00-\x1f]/g, '_');
  return stripped || 'file';
}
