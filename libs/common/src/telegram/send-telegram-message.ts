// Persistent custom keyboard shown below the chat's text input — used for
// the bot's top-level menu and the single "Назад" button. resize_keyboard
// shrinks the keys to fit the labels instead of Telegram's oversized
// default; is_persistent keeps it pinned rather than collapsing behind the
// input's keyboard icon after first use.
export interface TelegramReplyKeyboardMarkup {
  keyboard: string[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
}

// Explicitly clears whatever keyboard a chat currently has — used when a
// chat has no business seeing a menu (never linked, or no longer linked).
export interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
}

// A button attached directly to a specific message (not the persistent
// bottom keyboard) — tapping it sends a `callback_query` update carrying
// `callback_data` back to the webhook, rather than typing the button's
// label as a text message the way TelegramReplyKeyboardMarkup buttons do.
// Used for per-item selection out of a dynamic list (e.g. one button per
// knowledge-base article) where the item count/labels aren't fixed enough
// to be reply-keyboard buttons.
export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export type TelegramReplyMarkup = TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove | TelegramInlineKeyboardMarkup;

// Thin wrapper over Telegram's Bot API sendMessage — shared by
// ticket-service's telegram-ingestion (the /start greeting, menu, and
// ticket replies) and chat-service's outbound relay (an operator's public
// reply to a Telegram-channel ticket), so both send through the exact same
// shape instead of drifting apart. Uses Node's native global fetch — no
// HTTP client dependency exists in either service, and none is needed for
// a single, simple JSON POST.
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
  // Only ever pass 'HTML' for text that's already gone through
  // commentHtmlToTelegramHtml (or an equally deliberate HTML-safe
  // builder) — everything else (static bot copy, stripped-plain-text
  // article bodies) is sent with no parse_mode so a stray `<`/`&` in user
  // content can never be misread as markup and break the send.
  parseMode?: 'HTML',
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      ...(parseMode ? { parse_mode: parseMode } : {}),
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendMessage ${res.status}: ${await res.text()}`);
  }
}

// sendPhoto, given a URL instead of file bytes — Telegram fetches the image
// itself server-side, so this is a plain JSON POST like sendTelegramMessage
// rather than the multipart upload sendTelegramPhoto (send-telegram-file.ts)
// needs for locally-held bytes. Only appropriate when the URL is already
// durably, publicly reachable (no auth) — e.g. a knowledge-base article's
// inline image, served by knowledge-service's PublicImagesController.
export async function sendTelegramPhotoByUrl(token: string, chatId: string, photoUrl: string, caption?: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      ...(caption ? { caption } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendPhoto ${res.status}: ${await res.text()}`);
  }
}

// Acknowledges an inline-keyboard tap (a `callback_query` update) —
// required or the tapped button shows a loading spinner client-side until
// it times out. `text`, when given, shows as a small transient toast
// instead of a new chat message — used for lightweight progress feedback
// (e.g. "N of M questions answered") that doesn't deserve its own bubble.
export async function answerTelegramCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`Telegram answerCallbackQuery ${res.status}: ${await res.text()}`);
  }
}

// Swaps a specific already-sent message's inline keyboard — used to strip
// the "Активировать/Отклонить" buttons off a registration-approval prompt
// once one admin has acted on it, so that same admin's own copy can't be
// double-tapped (a SECOND admin's copy of the same prompt still shows
// buttons until they tap too, at which point the conditional DB write's
// "0 rows affected" check answers them with a toast instead of erroring —
// editing every admin's copy would need per-recipient message-id
// bookkeeping this doesn't attempt).
export async function editTelegramMessageReplyMarkup(
  token: string,
  chatId: string,
  messageId: number,
  replyMarkup: TelegramInlineKeyboardMarkup,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`Telegram editMessageReplyMarkup ${res.status}: ${await res.text()}`);
  }
}
