import { AxiosError } from 'axios';
import i18n from '../i18n.js';

// A handful of backend validation errors (attachment upload, so far) carry
// a stable `code` alongside the raw `message` — see HttpExceptionFilter and
// AttachmentsController's exceptionFactory. `message` there is deliberately
// raw, English, developer-facing text (NestJS's own built-in validators
// generate it, e.g. "Validation failed (current file type is
// application/x-msdownload, expected type is /^(...)/) - magic number
// detection failed, used mimetype fallback") — never meant to reach an end
// user. Known codes get mapped to a real translated string instead; any
// code this map doesn't recognize (or no code at all) falls through to the
// existing raw-`message`/generic-fallback behavior below, unchanged.
const KNOWN_ERROR_CODES: Record<string, string> = {
  ATTACHMENT_TOO_LARGE: 'errors.attachmentTooLarge',
  ATTACHMENT_UNSUPPORTED_TYPE: 'errors.attachmentUnsupportedType',
};

// The backend normally sends {message: string}, but a request can also be
// rejected before it ever reaches the backend (nginx's own rate limiter,
// a network drop) with a body that isn't that shape — reading .message off
// a non-object body silently resolves to undefined, which used to mean the
// UI showed NO error text at all instead of an explanation. This always
// returns something displayable.
//
// The fallback default is evaluated fresh on every call (not once at
// import time), so it reflects whatever language is active when the error
// actually occurs — same reason the branches below call i18n.t() directly
// instead of reading a module-level constant.
export function getErrorMessage(error: unknown, fallback = i18n.t('errors.somethingWrong')): string {
  if (!(error instanceof AxiosError)) {
    return fallback;
  }
  const data = error.response?.data as { message?: unknown; code?: unknown } | undefined;
  if (data && typeof data.code === 'string' && data.code in KNOWN_ERROR_CODES) {
    return i18n.t(KNOWN_ERROR_CODES[data.code]);
  }
  if (data && typeof data.message === 'string') {
    return data.message;
  }
  if (error.response?.status === 429) {
    return i18n.t('errors.tooManyRequests');
  }
  if (error.code === 'ERR_NETWORK') {
    return i18n.t('errors.networkError');
  }
  return fallback;
}
