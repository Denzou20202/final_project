// Most popular screenshot/image formats — matches ALLOWED_MIME_TYPES' image
// branch in ticket-service's attachments.controller.ts. Extension-based
// rather than a stored MIME type: AttachmentEntity never persisted one (see
// attachments.service.ts), and every upload path here controls the
// filename/extension itself, so this is a reliable enough signal.
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp)$/i;

// Same idea for video — matches ALLOWED_MIME_TYPES' video branch (mp4/webm/
// mov/m4v). Playback of .mov depends on its inner codec (usually H.264 →
// plays fine in Chromium); the file still uploads and downloads regardless.
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.test(fileName);
}

export function isVideoFile(fileName: string): boolean {
  return VIDEO_EXTENSIONS.test(fileName);
}
