// Mirrors ticket-service's attachment-mime-types.ts — same reasoning: a
// file's declared Content-Type and its sniffed bytes are two independent
// values in NestJS's FileTypeValidator (sniffing success never cross-checks
// the declared mimetype), so what actually gets stored/served must be
// re-validated against this allowlist independently, never trusted verbatim
// from the client. This one matters even more than the ticket-attachment
// case: these images are served completely unauthenticated to any internet
// visitor (see PublicImagesController), with no Content-Disposition either
// (they're meant to render inline as <img> in a published article).
export const ALLOWED_IMAGE_MIME_TYPES = /^image\/(png|jpeg|gif|webp)$/;

export function safeStoredImageContentType(declaredMimeType: string): string {
  return ALLOWED_IMAGE_MIME_TYPES.test(declaredMimeType) ? declaredMimeType : 'application/octet-stream';
}
