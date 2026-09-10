import type { TelegramReplyMarkup } from './send-telegram-message.js';

// Sends a file to a Telegram chat — used for the outbound half of the
// attachment relay (an operator's uploaded file, forwarded to a
// Telegram-channel ticket's client) and for re-sending an already-stored
// attachment when a client opens a ticket's detail view in the bot
// (telegram-ingestion.service.ts's sendStoredAttachment). Multipart upload
// via Node's native FormData/Blob/fetch — no HTTP client dependency needed,
// same reasoning as sendTelegramMessage.
//
// sendPhoto renders inline with a preview in the Telegram client;
// sendDocument is the generic fallback for anything that isn't an image
// (or is too large/unusual for Telegram's photo pipeline, which
// re-compresses and has stricter format requirements than plain file
// upload).
//
// replyMarkup is optional because most sends in a multi-message sequence
// (e.g. several attachments in a row) carry none — Telegram's multipart API
// takes reply_markup as a JSON-encoded string field, same as any other
// complex-typed field on a multipart call, unlike sendTelegramMessage's
// plain JSON body.
async function sendTelegramFile(
  token: string,
  method: 'sendPhoto' | 'sendDocument',
  field: 'photo' | 'document',
  chatId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  caption?: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<void> {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  form.append(field, new Blob([buffer], { type: mimeType }), filename);
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Telegram ${method} ${res.status}: ${await res.text()}`);
  }
}

export function sendTelegramPhoto(
  token: string,
  chatId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  caption?: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<void> {
  return sendTelegramFile(token, 'sendPhoto', 'photo', chatId, buffer, filename, mimeType, caption, replyMarkup);
}

export function sendTelegramDocument(
  token: string,
  chatId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  caption?: string,
  replyMarkup?: TelegramReplyMarkup,
): Promise<void> {
  return sendTelegramFile(token, 'sendDocument', 'document', chatId, buffer, filename, mimeType, caption, replyMarkup);
}
