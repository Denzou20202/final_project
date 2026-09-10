import type { BotStrings, JwtPayload, TelegramMessageEntity } from '@veloxdesk/common';
import {
  answerTelegramCallbackQuery,
  AutomationTriggerProducerService,
  BOT_STRINGS,
  commentHtmlToTelegramText,
  downloadTelegramFile,
  editTelegramMessageReplyMarkup,
  escapeTelegramHtml,
  NotificationsProducerService,
  sanitizeCommentBody,
  SearchIndexProducerService,
  sendTelegramDocument,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramPhotoByUrl,
  telegramEntitiesToHtml,
} from '@veloxdesk/common';
import type {
  TelegramInlineKeyboardButton,
  TelegramInlineKeyboardMarkup,
  TelegramReplyKeyboardMarkup,
  TelegramReplyKeyboardRemove,
  TelegramReplyMarkup,
} from '@veloxdesk/common';
import {
  AttachmentEntity,
  CommentEntity,
  CsatQuestionEntity,
  KnowledgeArticleEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketStatusEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import {
  AutomationTrigger,
  KnowledgeArticleStatus,
  Locale,
  NotificationType,
  TicketActivityType,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  UserRole,
} from '@veloxdesk/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
import { ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES, sanitizeAttachmentFileName } from '../attachments/attachment-mime-types.js';
import { S3Service } from '../attachments/s3.service.js';
import { CsatService } from '../csat/csat.service.js';
import { SlaPoliciesRepository } from '../sla/sla-policies.repository.js';
import { TicketEventsPublisherService } from '../ticket-events/ticket-events-publisher.service.js';
import { TicketStatusesRepository } from '../ticket-statuses/ticket-statuses.repository.js';
import { TicketTypesRepository } from '../ticket-types/ticket-types.repository.js';
import { toPublicTicketStatus } from '../ticket-statuses/ticket-status.public.js';
import { TelegramUserResolverService } from './telegram-user-resolver.service.js';

const TITLE_MAX_LENGTH = 60;
const LIST_CAP = 20;

// All user-facing text lives in BOT_STRINGS (libs/common) now, keyed by
// Locale — see that file's own comment for why. ALL_LOCALES is iterated
// below to build the per-locale keyboards and the menu-button reverse
// lookup once at module load, rather than on every message.
const ALL_LOCALES = Object.values(Locale);

// --- Reply-keyboard menu ---------------------------------------------------
// Shown whenever the bot is "at the top level": bare /start while linked, a
// successful /start <token> link, and after every plain-text reply/ticket
// confirmation — so the menu is always available, not just after an
// explicit navigation.
function buildMainMenuKeyboard(s: BotStrings): TelegramReplyKeyboardMarkup {
  return {
    keyboard: [
      [s.btnCreateTicket, s.btnMyTickets],
      [s.btnWatching, s.btnHistory],
      [s.btnKnowledgeBase],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}
const MAIN_MENU_KEYBOARDS = Object.fromEntries(
  ALL_LOCALES.map((locale) => [locale, buildMainMenuKeyboard(BOT_STRINGS[locale])]),
) as Record<Locale, TelegramReplyKeyboardMarkup>;

// Shown after diving into any of the last three menu items, or after
// tapping "Создать тикет"/"Create ticket" to prompt for the ticket text.
const BACK_KEYBOARDS = Object.fromEntries(
  ALL_LOCALES.map((locale) => [
    locale,
    { keyboard: [[BOT_STRINGS[locale].btnBack]], resize_keyboard: true, is_persistent: true } as TelegramReplyKeyboardMarkup,
  ]),
) as Record<Locale, TelegramReplyKeyboardMarkup>;

// Defensive cleanup for a chat that has no business showing a menu (never
// linked, or a link that has since been superseded) — attached to every
// reply sent to an unresolved sender so a stale keyboard from before a
// token expired can't linger client-side.
const REMOVE_KEYBOARD: TelegramReplyKeyboardRemove = { remove_keyboard: true };

// Reverse lookup from a reply-keyboard button's rendered TEXT (what Telegram
// actually echoes back on a tap) to the menu action it means — built from
// EVERY locale's button labels at once, not just the sender's current one.
// Necessary because the physical keyboard Telegram shows a client is
// whatever was last rendered client-side; if they change their language on
// the web portal mid-conversation without reopening the bot's menu, their
// keyboard still shows the OLD locale's labels. Routing by raw text
// equality against only the current locale would silently fail to match a
// stale-language tap and misfile it as free ticket text instead of
// navigating. The bot's OWN reply still always uses the sender's current
// locale — only the incoming tap's routing is locale-agnostic.
type MenuAction = 'create' | 'myTickets' | 'watching' | 'history' | 'knowledgeBase' | 'back';
const MENU_BUTTON_LOOKUP: Record<string, MenuAction> = ALL_LOCALES.reduce<Record<string, MenuAction>>((acc, locale) => {
  const s = BOT_STRINGS[locale];
  acc[s.btnCreateTicket] = 'create';
  acc[s.btnMyTickets] = 'myTickets';
  acc[s.btnWatching] = 'watching';
  acc[s.btnHistory] = 'history';
  acc[s.btnKnowledgeBase] = 'knowledgeBase';
  acc[s.btnBack] = 'back';
  return acc;
}, {});

// Compact per-status glyph for inline-keyboard button labels — Telegram
// caps button text at 64 bytes, too little room for the full statusLabels
// wording alongside a ticket number and title, so status is conveyed as a
// color-coded dot there instead (same idea as the web sidebar's status
// dots) and spelled out in full only in the ticket-detail header. Locale-
// invariant — an emoji, not translated text. Only the 4 seeded statuses
// (identified by `key`) get a distinct glyph; an admin-created custom
// status (key: null) falls back to a generic dot — there's no way to
// derive a meaningful emoji from an arbitrary admin-picked hex color.
const STATUS_EMOJI: Partial<Record<TicketStatus, string>> = {
  [TicketStatus.OPEN]: '🟢',
  [TicketStatus.PENDING]: '🟡',
  [TicketStatus.RESOLVED]: '🔵',
  [TicketStatus.CLOSED]: '⚪',
};
const DEFAULT_STATUS_EMOJI = '🟣';

function statusEmoji(status: TicketStatusEntity): string {
  return (status.key ? STATUS_EMOJI[status.key] : undefined) ?? DEFAULT_STATUS_EMOJI;
}

// Tighter than TITLE_MAX_LENGTH — this truncation feeds an inline-keyboard
// button's `text`, which Telegram caps at 64 bytes total including the
// status emoji and ticket number prefix.
const BUTTON_TITLE_MAX_LENGTH = 32;

// Comments per "page" in a ticket's detail view — bounds both the number of
// DB rows fetched per tap and, per individual comment now that each one is
// its own Telegram message (see COMMENT_TEXT_MAX_LENGTH below), the
// rendered message length.
const COMMENTS_PAGE_SIZE = 5;
const COMMENT_TEXT_MAX_LENGTH = 3200;
// Defensive cap on a single comment page's attachments — the query is
// already scoped to just that page's comment ids (see
// fetchCommentPageWithAttachments), this just guards against one comment
// with a pathological number of attachments.
const ATTACHMENTS_LIST_CAP = 10;

// Callback data prefixes for the ticket-detail flow — 'ticket' prefixes are
// distinct from the pre-existing 'kb:'/'csat:'/'admin:' ones above so
// handleCallbackQuery can keep routing unambiguously. `source` is a
// single-letter tag ('m' = Мои тикеты, 'w' = Под контролем, 'h' = История)
// so «Назад к списку» and outbound push notifications' deep-link button
// know which list to return to / which list a tap originated from, all
// while staying comfortably under Telegram's 64-byte callback_data limit
// alongside a full uuid.
const TICKET_CALLBACK_PREFIX = 'ticket:';
const TICKET_MORE_PREFIX = 'tmore:';
const TICKET_WATCH_TOGGLE_PREFIX = 'twatch:';
const TICKET_BACK_PREFIX = 'tback:';

type TicketListSource = 'm' | 'w' | 'h';

function isTicketListSource(value: string | undefined): value is TicketListSource {
  return value === 'm' || value === 'w' || value === 'h';
}

// One unit of the ticket-detail "chat" send sequence (sendCommentJobs) — a
// comment's text, or one of its attachments. Telegram can't put an inline
// image inside a text message, so a real chat-like view has to be a
// sequence of separate messages in read order, same idea as sendArticle's
// text/table/image segments elsewhere in this file. `caption` is only ever
// set on the first attachment of a comment that had no text of its own (see
// buildCommentSendJobs) — it carries the time/author context that would
// otherwise have needed its own redundant "author: —" text message.
type CommentSendJob =
  | { kind: 'text'; text: string }
  | { kind: 'attachment'; attachment: AttachmentEntity; caption?: string };

// Hardcoded rather than a new env var: this single-tenant deployment's
// domain is already hardcoded the same way in the setWebhook operational
// step. Shared by the article permalink below and by extractArticleImageUrls
// (absolutizing an article's inline `<img src="/api/public/images/...">`).
const SITE_ORIGIN = 'https://veloxdesk.pp.ua';
// The public client-facing article page — same route KB_ARTICLE_HREF_RE
// (sanitize-comment-body.ts) validates for in-app links.
const KB_ARTICLE_BASE_URL = `${SITE_ORIGIN}/faq`;
// Keeps title + truncated body + link comfortably under Telegram's
// 4096-char sendMessage limit even for a long title.
const ARTICLE_BODY_MAX_LENGTH = 3500;
// Upper bound on inline screenshots relayed per article — same defensive
// cap as ATTACHMENTS_LIST_CAP, guarding against an outlier article with an
// unusually large number of embedded images flooding the chat.
const ARTICLE_IMAGES_CAP = 10;

// Callback data prefixes — kept short and distinct so handleCallbackQuery
// can route without ambiguity while staying well under Telegram's 64-byte
// callback_data limit even alongside a full uuid.
const KB_CALLBACK_PREFIX = 'kb:';
const CSAT_CALLBACK_PREFIX = 'csat:';

// Mirrors telegram-admin-notify.service.ts's own copies of these two
// prefixes exactly — see that file's comment for why they're duplicated
// rather than shared.
const ADMIN_APPROVE_PREFIX = 'admin:approve:';
const ADMIN_REJECT_PREFIX = 'admin:reject:';

function listHeader(s: BotStrings, label: string, shown: number, total: number): string {
  return total > shown ? `${label} (${s.listHeaderPartial(shown, total)}):` : `${label}:`;
}

function truncate(text: string, maxLength = TITLE_MAX_LENGTH): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

type ArticleSegment = { type: 'text'; text: string } | { type: 'table'; html: string } | { type: 'image'; url: string };

// sanitizeArticleBody (libs/common) allows only a small, flat, non-nested
// set of block tags — p/ul/ol/blockquote/img/table, Tiptap's Image
// extension is a block-level node so `<img>` always sits as its own
// top-level element, never wrapped inside a `<p>` (verified against real
// article content: e.g. `<p>СТАТЬЯ ТЕСТ<br /></p><img src="..." /><p></p>`)
// — so one non-greedy top-level regex is enough to walk the document in
// order; a general HTML parser isn't needed for content this constrained.
const ARTICLE_BLOCK_PATTERN =
  /<p>[\s\S]*?<\/p>|<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>|<blockquote>[\s\S]*?<\/blockquote>|<table>[\s\S]*?<\/table>|<img[^>]*>/gi;

// Telegram's plain sendMessage has no table rendering at all, and its HTML
// parse_mode subset doesn't include <table> either — the only way a grid
// reads as a grid rather than run-together text is a padded, fixed-width
// layout inside a monospace <pre> block (parse_mode: 'HTML'; see
// sendArticle's use of this segment type). Any single cell longer than this
// gets truncated with an ellipsis so one long cell can't blow out every
// row's width.
const TABLE_CELL_MAX_WIDTH = 24;

// Renders a `<table>...</table>` block (sanitizeArticleBody's shape: no
// <thead> — Tiptap puts header <th> rows inside the same <tbody> as
// everything else, see that function's own comment) as a plain aligned
// grid: first row as the header, a `---+---` divider, then the rest.
// Returns an HTML string ALREADY wrapped in `<pre>` and escaped — the
// caller sends it with parse_mode: 'HTML' verbatim, no further processing.
function renderArticleTableHtml(block: string): string {
  const rows = [...block.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
    [...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cellMatch) =>
      commentHtmlToTelegramText(cellMatch[1]).replace(/\s*\n\s*/g, ' '),
    ),
  );
  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.min(TABLE_CELL_MAX_WIDTH, Math.max(3, ...rows.map((r) => (r[i] ?? '').length))),
  );
  const renderRow = (cells: string[]) =>
    Array.from({ length: colCount }, (_, i) => {
      const cell = cells[i] ?? '';
      const width = colWidths[i];
      return (cell.length > width ? `${cell.slice(0, width - 1)}…` : cell).padEnd(width);
    }).join(' | ');

  const lines = [renderRow(rows[0]), colWidths.map((w) => '-'.repeat(w)).join('-+-'), ...rows.slice(1).map(renderRow)];
  return `<pre>${escapeTelegramHtml(lines.join('\n'))}</pre>`;
}

// Renders one non-image top-level block to plain text. Lists lose their
// numbering/bullets entirely if just run through commentHtmlToTelegramText
// (its </li> → \n rule flattens every item to a bare line) — this restores
// real "1. "/"• " markers per item, and gives a blockquote a "> " prefix so
// it doesn't read as an ordinary paragraph either.
function renderArticleBlockText(block: string): string {
  if (/^<ul>/i.test(block)) {
    return [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => `• ${commentHtmlToTelegramText(m[1])}`).join('\n');
  }
  if (/^<ol>/i.test(block)) {
    return [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
      .map((m, i) => `${i + 1}. ${commentHtmlToTelegramText(m[1])}`)
      .join('\n');
  }
  if (/^<blockquote>/i.test(block)) {
    const inner = commentHtmlToTelegramText(block.replace(/^<blockquote>|<\/blockquote>$/gi, ''));
    return inner
      .split('\n')
      .map((line) => (line ? `> ${line}` : line))
      .join('\n');
  }
  return commentHtmlToTelegramText(block);
}

// sanitizeArticleBody only ever allows `img` with a `src`/`alt` pair set by
// ArticleImagesService.upload — always a root-relative
// `/api/public/images/<uuid>` path — so this absolutizes against
// SITE_ORIGIN; an already-absolute http(s) src (not something the current
// upload path produces, but cheap to handle defensively) is passed through
// unchanged rather than double-prefixed.
function absolutizeArticleImageUrl(src: string): string {
  return /^https?:\/\//i.test(src) ? src : `${SITE_ORIGIN}${src}`;
}

// Walks an article's Tiptap HTML in document order and splits it into
// alternating text/table/image segments, so sendArticle can relay each one
// interleaved at its real position in the article — right after the text
// that precedes it — instead of bunching every image at the end regardless
// of where it actually belongs. `title` seeds the very first text segment
// so it always leads the first message sent, whatever block the article
// itself happens to start with. Consecutive plain-text blocks are merged
// into one text segment (joined by a blank line) — an image or table each
// force their own message, same as each other.
function parseArticleSegments(html: string, title: string, imageCap: number): ArticleSegment[] {
  const blocks = html.match(ARTICLE_BLOCK_PATTERN) ?? [];

  const segments: ArticleSegment[] = [];
  let pendingText: string[] = [title];
  let imageCount = 0;

  const flushText = () => {
    if (pendingText.length > 0) {
      segments.push({ type: 'text', text: pendingText.join('\n\n') });
      pendingText = [];
    }
  };

  for (const block of blocks) {
    if (/^<img/i.test(block)) {
      if (imageCount >= imageCap) continue;
      const match = /\ssrc="([^"]+)"/i.exec(block);
      if (!match) continue;
      flushText();
      segments.push({ type: 'image', url: absolutizeArticleImageUrl(match[1]) });
      imageCount++;
      continue;
    }
    if (/^<table>/i.test(block)) {
      const tableHtml = renderArticleTableHtml(block);
      if (!tableHtml) continue;
      flushText();
      segments.push({ type: 'table', html: tableHtml });
      continue;
    }
    const rendered = renderArticleBlockText(block);
    if (rendered) pendingText.push(rendered);
  }
  flushText();
  return segments;
}

const LOCALE_TO_INTL: Record<Locale, string> = {
  [Locale.RU]: 'ru-RU',
  [Locale.UK]: 'uk-UA',
  [Locale.EN]: 'en-US',
};

function formatDateTime(date: Date, locale: Locale): string {
  return new Date(date).toLocaleString(LOCALE_TO_INTL[locale], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Inline-keyboard button label for one row of a ticket list — status is a
// glyph rather than STATUS_LABELS' full wording (see BUTTON_TITLE_MAX_LENGTH's
// comment for why), and the button's callback_data carries the ticket id
// plus which list it was tapped from, resolved by handleTicketDetail /
// «Назад к списку».
function formatTicketButton(
  t: Pick<TicketEntity, 'id' | 'ticketNumber' | 'title' | 'status'>,
  source: TicketListSource,
): TelegramInlineKeyboardButton {
  return {
    text: `${statusEmoji(t.status)} №${t.ticketNumber} — ${truncate(t.title, BUTTON_TITLE_MAX_LENGTH)}`,
    callback_data: `${TICKET_CALLBACK_PREFIX}${t.id}:${source}`,
  };
}

// Telegram's Update object — narrowly typed to just the shape we actually
// read. Deliberately `Record<string, unknown>` at the controller boundary
// (see telegram-webhook.controller.ts) and narrowed defensively here rather
// than trusting a full DTO, since Telegram can add fields at any time.
interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string; type?: string };
    text?: string;
    entities?: TelegramMessageEntity[];
    caption?: string;
    caption_entities?: TelegramMessageEntity[];
    photo?: { file_id: string; file_size?: number }[];
    document?: { file_id: string; file_name?: string; mime_type?: string };
  };
  // Sent when the client taps an inline-keyboard button (see
  // TelegramInlineKeyboardMarkup) — a distinct update shape from a plain
  // message, with its own chat reference nested under `message`.
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat?: { id?: number | string }; message_id?: number };
  };
}

@Injectable()
export class TelegramIngestionService {
  private readonly logger = new Logger(TelegramIngestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly userResolver: TelegramUserResolverService,
    private readonly notificationsProducer: NotificationsProducerService,
    private readonly ticketEventsPublisher: TicketEventsPublisherService,
    private readonly slaPoliciesRepository: SlaPoliciesRepository,
    private readonly searchIndexProducer: SearchIndexProducerService,
    private readonly automationTriggerProducer: AutomationTriggerProducerService,
    private readonly s3Service: S3Service,
    private readonly csatService: CsatService,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
    @InjectRepository(TicketActivityEntity)
    private readonly activityRepository: Repository<TicketActivityEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(KnowledgeArticleEntity)
    private readonly articlesRepository: Repository<KnowledgeArticleEntity>,
    @InjectRepository(AttachmentEntity)
    private readonly attachmentsRepository: Repository<AttachmentEntity>,
    @InjectRepository(CsatQuestionEntity)
    private readonly csatQuestionsRepository: Repository<CsatQuestionEntity>,
    @InjectRepository(TicketWatcherEntity)
    private readonly watchersRepository: Repository<TicketWatcherEntity>,
    private readonly ticketStatusesRepository: TicketStatusesRepository,
    private readonly ticketTypesRepository: TicketTypesRepository,
  ) {}

  async processUpdate(raw: Record<string, unknown>): Promise<void> {
    const update = raw as TelegramUpdate;

    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    const message = update.message;
    const hasMedia = !!(message?.photo?.length || message?.document);

    // Silently no-op (still a 200 to the controller) on anything that isn't
    // a plain text OR photo/document message in a private chat —
    // edited_message/channel_post/group chats/voice/stickers are all out
    // of scope for v1.
    if (!message || message.chat?.type !== 'private' || (!hasMedia && !message.text?.trim())) {
      return;
    }

    const chatId = String(message.chat?.id);
    const text = message.text?.trim() ?? '';

    // Every brand-new user's first-ever interaction with any Telegram bot
    // is Telegram itself sending literal text "/start" the moment they tap
    // the bot's Start button — with an optional deep-link payload appended
    // ("/start <token>") when they arrived via the client-portal "Подключить
    // Telegram" link (t.me/<bot>?start=<token>). Handle both shapes here so
    // neither ever falls through to ticket-creation below. Media messages
    // never carry a command, so this only ever applies to text.
    if (!hasMedia && (text === '/start' || text.startsWith('/start '))) {
      const payload = text.slice('/start'.length).trim();
      if (payload) {
        const linked = await this.userResolver.linkByToken(payload, chatId);
        const linkedLocale = linked?.locale ?? Locale.RU;
        const s = BOT_STRINGS[linkedLocale];
        await this.sendReply(chatId, linked ? s.linkSuccess : s.linkFailed, linked ? MAIN_MENU_KEYBOARDS[linkedLocale] : REMOVE_KEYBOARD);
      } else {
        const existing = await this.userResolver.findByChatId(chatId);
        const s = BOT_STRINGS[existing?.locale ?? Locale.RU];
        await this.sendReply(
          chatId,
          existing ? s.greetingLinked : s.greetingUnlinked,
          existing ? MAIN_MENU_KEYBOARDS[existing?.locale ?? Locale.RU] : REMOVE_KEYBOARD,
        );
      }
      return;
    }

    // Closed bot — a chat.id that never completed /start <token> resolves
    // to null here, and gets turned away rather than auto-provisioned a
    // new account (that auto-create behavior was the entire thing the
    // closed-bot change removed). Also catches a stale menu keyboard from
    // before a token expired — REMOVE_KEYBOARD scrubs it either way.
    const sender = await this.userResolver.findByChatId(chatId);
    if (!sender) {
      await this.sendReply(chatId, BOT_STRINGS[Locale.RU].greetingUnlinked, REMOVE_KEYBOARD);
      return;
    }
    const locale = sender.locale ?? Locale.RU;
    const s = BOT_STRINGS[locale];

    // --- Reply-keyboard menu routing (text only) ------------------------
    // Button taps arrive as ordinary text messages whose content is exactly
    // the tapped button's label — no separate callback_query handling
    // needed. Matched before the plain-text/ticket fallthrough below, so a
    // client can never accidentally "reply" a menu label into a ticket.
    // MENU_BUTTON_LOOKUP (not a direct comparison against this locale's own
    // BTN_* labels) — see that constant's own comment for why: the tap may
    // carry a DIFFERENT locale's label if the client's physical keyboard
    // predates a language switch on the web portal.
    if (!hasMedia) {
      const menuAction = MENU_BUTTON_LOOKUP[text];
      if (menuAction === 'create') {
        await this.usersRepository.update(
          { id: sender.id },
          { telegramPendingNewTicket: true, telegramPendingReplyToTicketId: null },
        );
        await this.sendReply(chatId, s.createTicketPrompt, BACK_KEYBOARDS[locale]);
        return;
      }
      if (menuAction) {
        // Navigating anywhere else cancels an abandoned "Создать тикет" tap
        // or an abandoned per-ticket "Ответить" tap — otherwise a later,
        // unrelated message would unexpectedly force-create a duplicate
        // ticket, or land on a ticket the client no longer meant to reply
        // to, instead of following the normal auto-detect/menu flow.
        if (sender.telegramPendingNewTicket || sender.telegramPendingReplyToTicketId) {
          await this.usersRepository.update(
            { id: sender.id },
            { telegramPendingNewTicket: false, telegramPendingReplyToTicketId: null },
          );
        }
        if (menuAction === 'back') {
          await this.sendReply(chatId, s.backText, MAIN_MENU_KEYBOARDS[locale]);
          return;
        }
        if (menuAction === 'myTickets') {
          await this.sendMyTickets(chatId, sender.id, locale);
          return;
        }
        if (menuAction === 'watching') {
          await this.sendWatchingTickets(chatId, sender.id, locale);
          return;
        }
        if (menuAction === 'history') {
          await this.sendTicketHistory(chatId, sender.id, locale);
          return;
        }
        await this.sendKnowledgeBase(chatId, locale);
        return;
      }
    }

    // --- Plain text / photo / document: append to or create a ticket ----
    const rawBody = hasMedia ? (message.caption?.trim() ?? '') : text;
    const bodyEntities = hasMedia ? message.caption_entities : message.entities;
    const bodyHtml = rawBody ? telegramEntitiesToHtml(rawBody, bodyEntities) : '';
    const sanitizedText = bodyHtml ? sanitizeCommentBody(bodyHtml) : '';

    // Attachment download happens before any ticket/comment write — if it
    // fails, the client still gets a real response (their caption text, if
    // any, isn't silently lost) rather than a half-created mess.
    let attachment: { buffer: Buffer; filename: string; mimeType: string } | undefined;
    if (hasMedia) {
      const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
      if (token) {
        attachment = await this.downloadIncomingAttachment(token, message).catch((error) => {
          this.logger.warn(`Failed to download Telegram attachment: ${error instanceof Error ? error.message : error}`);
          return undefined;
        });
        if (!attachment) {
          await this.sendReply(chatId, s.attachmentFailed, MAIN_MENU_KEYBOARDS[locale]);
        }
      }
    }

    const fallbackTitle = message?.photo?.length ? s.photoFallbackTitle : s.documentFallbackTitle;
    const effectiveText = sanitizedText || (hasMedia ? fallbackTitle : '');

    // Opening a ticket's detail view (see handleTicketDetailCallback) targets
    // THIS message at that specific ticket, overriding the channel-scoped
    // auto-detect below — the whole point is letting a client with several
    // open tickets pick which one they're replying to just by tapping into
    // it, including tickets that didn't originate on Telegram at all.
    let pendingReplyTicket: TicketEntity | null = null;
    if (sender.telegramPendingReplyToTicketId) {
      const targetId = sender.telegramPendingReplyToTicketId;
      await this.usersRepository.update({ id: sender.id }, { telegramPendingReplyToTicketId: null });
      const target = await this.ticketsRepository.findOne({ where: { id: targetId }, relations: ['status'] });
      if (target && target.createdBy === sender.id && !target.status.isClosed) {
        pendingReplyTicket = target;
      } else if (target && target.createdBy === sender.id) {
        // Race: the ticket got closed between the client tapping «Ответить»
        // and actually sending their message — fall through to the normal
        // auto-detect/create-new flow below instead of silently discarding
        // what they typed, but tell them it didn't land where expected.
        await this.sendReply(chatId, s.replyTargetClosed, MAIN_MENU_KEYBOARDS[locale]);
      }
    }

    let forceNew = false;
    if (!pendingReplyTicket && sender.telegramPendingNewTicket) {
      forceNew = true;
      await this.usersRepository.update({ id: sender.id }, { telegramPendingNewTicket: false });
    }

    // "Does this client have an open conversation on THIS channel" —
    // channel-scoped (not just createdBy), or a client with an existing
    // open portal ticket messaging the bot would get silently merged into
    // it; Telegram has no thread/subject header the way email does, so
    // this is the only well-defined question to ask. Not(CLOSED) rather
    // than = OPEN because postMessage() itself only refuses CLOSED tickets
    // (PENDING/RESOLVED are still writable) — using only OPEN would
    // incorrectly spawn a duplicate for a reply on a
    // PENDING/RESOLVED-but-not-yet-closed one.
    //
    // Matches by createdBy OR by "sender has an existing comment on this
    // ticket" — the second clause is what keeps this working after
    // TicketsService.merge(): a merge re-points a source ticket's comments
    // onto the surviving target but never touches the target's createdBy,
    // so a client whose own ticket got merged into someone else's would
    // otherwise never match here again, silently spinning up a brand-new
    // duplicate ticket every time they wrote back (the exact bug this
    // clause fixes).
    const existingTicket =
      pendingReplyTicket ??
      (forceNew
        ? null
        : await this.ticketsRepository
            .createQueryBuilder('ticket')
            .innerJoinAndSelect('ticket.status', 'status')
            .where('ticket.channel = :channel', { channel: TicketChannel.TELEGRAM })
            .andWhere('status.isClosed = false')
            .andWhere(
              '(ticket.createdBy = :senderId OR EXISTS (SELECT 1 FROM comments c WHERE c.ticket_id = ticket.id AND c.author_id = :senderId))',
              { senderId: sender.id },
            )
            .orderBy('ticket.createdAt', 'DESC')
            .getOne());

    let ticket: TicketEntity;
    let comment: CommentEntity;
    if (existingTicket) {
      comment = await this.appendReply(existingTicket, sender.id, effectiveText);
      ticket = existingTicket;
      await this.sendReply(chatId, s.appendConfirmation(existingTicket.ticketNumber), MAIN_MENU_KEYBOARDS[locale]);
    } else {
      const created = await this.createTicketFromTelegram(sender.id, effectiveText);
      ticket = created.ticket;
      comment = created.comment;
      await this.sendReply(chatId, s.newTicketConfirmation(created.ticket.ticketNumber), MAIN_MENU_KEYBOARDS[locale]);
    }

    if (attachment) {
      await this.uploadTelegramAttachment(ticket, comment.id, sender.id, attachment);
    }
  }

  private async downloadIncomingAttachment(
    token: string,
    message: NonNullable<TelegramUpdate['message']>,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    if (message.photo?.length) {
      // Telegram sends ascending resolutions — the last entry is the
      // largest available.
      const largest = message.photo[message.photo.length - 1];
      const { buffer, filePath } = await downloadTelegramFile(token, largest.file_id);
      const filename = filePath.split('/').pop() || `photo-${Date.now()}.jpg`;
      // Telegram always transcodes "photo"-pipeline uploads to JPEG.
      return { buffer, filename, mimeType: 'image/jpeg' };
    }
    const doc = message.document;
    if (!doc) {
      throw new Error('downloadIncomingAttachment called with neither photo nor document');
    }
    const { buffer } = await downloadTelegramFile(token, doc.file_id);
    return {
      buffer,
      filename: doc.file_name || `file-${Date.now()}`,
      mimeType: doc.mime_type || 'application/octet-stream',
    };
  }

  // Mirrors AttachmentsService.upload's persistence (S3 object, entity row,
  // activity log, live-push notify) without its actor/assertAccess
  // machinery — the ticket is already resolved and authorized by
  // processUpdate's own sender-resolution logic above, and a synthetic
  // JwtPayload actor would fail assertAccess's strict createdBy check for
  // the post-merge case the query above was just fixed to handle (the
  // sender may legitimately not be `ticket.createdBy` after a merge).
  //
  // Unlike a web upload, this has no multipart form and never goes through
  // AttachmentsController's ParseFilePipe/FileTypeValidator/
  // MaxFileSizeValidator at all — `file.mimeType` here is `doc.mime_type`,
  // taken straight from whatever the sender's Telegram client declared, and
  // `file.buffer` has no size cap from this codebase (only Telegram's own
  // bot-API download limit). Both checks are re-applied by hand here so a
  // Telegram-linked client can't attach anything a web upload would have
  // rejected. The "photo" pipeline (message.photo, handled by the caller
  // before this ever runs for that branch) always transcodes to a real
  // image/jpeg server-side on Telegram's end, so it always passes this
  // unconditionally — only the arbitrary `document` branch is actually at
  // risk.
  private async uploadTelegramAttachment(
    ticket: TicketEntity,
    commentId: string,
    uploaderId: string,
    file: { buffer: Buffer; filename: string; mimeType: string },
  ): Promise<void> {
    if (file.buffer.length > ATTACHMENT_MAX_SIZE_BYTES || !ALLOWED_MIME_TYPES.test(file.mimeType)) {
      this.logger.warn(
        `Skipped Telegram attachment for ticket ${ticket.id}: failed validation (type=${file.mimeType}, size=${file.buffer.length})`,
      );
      return;
    }
    const key = `${ticket.id}/${randomUUID()}-${sanitizeAttachmentFileName(file.filename)}`;
    await this.s3Service.upload(key, file.buffer, file.mimeType);

    await this.attachmentsRepository.save(
      this.attachmentsRepository.create({
        ticketId: ticket.id,
        uploaderId,
        commentId,
        fileUrl: key,
        fileName: file.filename,
        fileSize: file.buffer.length,
      }),
    );

    await this.activityRepository.save(
      this.activityRepository.create({
        ticketId: ticket.id,
        actorId: uploaderId,
        type: TicketActivityType.ATTACHMENT_ADDED,
        toValue: file.filename,
      }),
    );

    // Live push so an operator with this ticket open sees the file without
    // a manual refresh — same event shape/reasoning as
    // TicketsService.notifyAttachmentAdded.
    await this.ticketEventsPublisher.publish({
      type: 'attachment',
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: toPublicTicketStatus(ticket.status),
      teamId: ticket.teamId,
      assignedTo: ticket.assignedTo,
      createdBy: ticket.createdBy,
    });
  }

  // parseMode is only ever passed as 'HTML' for text that's already gone
  // through commentHtmlToTelegramHtml/escapeTelegramHtml (or an article
  // table's own pre-escaped <pre> block — see renderArticleTableHtml) —
  // every other caller omits it, same plain-text-by-default rule
  // sendTelegramMessage's own comment documents.
  private async sendReply(chatId: string, text: string, replyMarkup?: TelegramReplyMarkup, parseMode?: 'HTML'): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;
    await sendTelegramMessage(token, chatId, text, replyMarkup, parseMode).catch((error) => {
      this.logger.warn(`Failed to send Telegram reply: ${error instanceof Error ? error.message : error}`);
    });
  }

  // Renders any ticket list (Мои/Под контролем/История) the same way: a
  // header text message on the persistent Назад keyboard, then a SEPARATE
  // message carrying one inline-keyboard button per ticket — mirrors
  // sendKnowledgeBase's own two-message shape below, for the same reason
  // (a single Telegram message's reply_markup can only be one shape, never
  // both a custom keyboard and an inline keyboard at once). Tapping a
  // button opens that ticket's detail view (see handleTicketDetail).
  private async sendTicketList(
    chatId: string,
    tickets: TicketEntity[],
    total: number,
    source: TicketListSource,
    headerLabel: string,
    emptyText: string,
    locale: Locale,
  ): Promise<void> {
    const s = BOT_STRINGS[locale];
    if (tickets.length === 0) {
      await this.sendReply(chatId, emptyText, BACK_KEYBOARDS[locale]);
      return;
    }
    await this.sendReply(chatId, listHeader(s, headerLabel, tickets.length, total), BACK_KEYBOARDS[locale]);
    const inlineKeyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: tickets.map((t) => [formatTicketButton(t, source)]),
    };
    await this.sendReply(chatId, s.chooseTicketText, inlineKeyboard);
  }

  // "Мои тикеты" — every non-closed ticket the client owns, regardless of
  // channel (portal/email/telegram all count — this is a general "what's
  // active" question, unlike the Telegram-channel-scoped lookup used for
  // implicit reply auto-detect elsewhere in this file).
  private async sendMyTickets(chatId: string, userId: string, locale: Locale): Promise<void> {
    const s = BOT_STRINGS[locale];
    const baseQb = () =>
      this.ticketsRepository
        .createQueryBuilder('ticket')
        .innerJoinAndSelect('ticket.status', 'status')
        .where('ticket.createdBy = :userId', { userId })
        .andWhere('status.isClosed = false');
    const [tickets, total] = await Promise.all([
      baseQb().orderBy('ticket.createdAt', 'DESC').take(LIST_CAP).getMany(),
      baseQb().getCount(),
    ]);
    await this.sendTicketList(chatId, tickets, total, 'm', s.myTicketsHeader, s.myTicketsEmpty, locale);
  }

  // "Под контролем" — necessarily a subset of "Мои тикеты": a client can
  // only ever watch their own tickets (TicketsService.watch /
  // getOwnedTicketOrThrow), so overlap with "Мои тикеты" is expected, not
  // a bug. Same join shape tickets.repository.ts already uses for
  // `?watching=me`.
  private async sendWatchingTickets(chatId: string, userId: string, locale: Locale): Promise<void> {
    const s = BOT_STRINGS[locale];
    const baseQb = () =>
      this.ticketsRepository
        .createQueryBuilder('ticket')
        .innerJoinAndSelect('ticket.status', 'status')
        .innerJoin('ticket_watchers', 'tw', 'tw.ticket_id = ticket.id AND tw.user_id = :userId', { userId })
        .where('status.isClosed = false');

    const [tickets, total] = await Promise.all([
      baseQb().orderBy('ticket.createdAt', 'DESC').take(LIST_CAP).getMany(),
      baseQb().getCount(),
    ]);
    await this.sendTicketList(chatId, tickets, total, 'w', s.watchingHeader, s.watchingEmpty, locale);
  }

  // "История" — every CLOSED ticket the client owns. Deliberately scoped to
  // createdBy alone, not a separate watcher-joined query: since watching a
  // ticket requires already owning it (see the "Под контролем" comment
  // above), "closed tickets I created" already covers every closed ticket
  // this client could ever have watched.
  private async sendTicketHistory(chatId: string, userId: string, locale: Locale): Promise<void> {
    const s = BOT_STRINGS[locale];
    const baseQb = () =>
      this.ticketsRepository
        .createQueryBuilder('ticket')
        .innerJoinAndSelect('ticket.status', 'status')
        .where('ticket.createdBy = :userId', { userId })
        .andWhere('status.isClosed = true');
    const [tickets, total] = await Promise.all([
      baseQb().orderBy('ticket.closedAt', 'DESC').take(LIST_CAP).getMany(),
      baseQb().getCount(),
    ]);
    await this.sendTicketList(chatId, tickets, total, 'h', s.historyHeader, s.historyEmpty, locale);
  }

  // "База знаний" — list message carries the persistent Назад keyboard;
  // article selection is a SEPARATE message with an inline keyboard, since
  // a single Telegram message's reply_markup can only be one shape (custom
  // keyboard OR inline keyboard, never both). Direct repository access
  // rather than an HTTP call to knowledge-service's public endpoint: all
  // backend services share one Postgres DB (same precedent already used by
  // user-service/users.service.ts against this exact entity), and this
  // read-only list doesn't need ArticlesService's ES-search backing.
  private async sendKnowledgeBase(chatId: string, locale: Locale): Promise<void> {
    const s = BOT_STRINGS[locale];
    const where = { status: KnowledgeArticleStatus.PUBLISHED } as const;
    const [articles, total] = await Promise.all([
      this.articlesRepository.find({ where, order: { createdAt: 'DESC' }, take: LIST_CAP }),
      this.articlesRepository.count({ where }),
    ]);
    if (articles.length === 0) {
      await this.sendReply(chatId, s.kbEmpty, BACK_KEYBOARDS[locale]);
      return;
    }
    await this.sendReply(chatId, listHeader(s, s.kbArticlesHeader, articles.length, total), BACK_KEYBOARDS[locale]);
    const inlineKeyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: articles.map((a) => [{ text: truncate(a.title), callback_data: `${KB_CALLBACK_PREFIX}${a.id}` }]),
    };
    await this.sendReply(chatId, s.kbChoose, inlineKeyboard);
  }

  // Header block for a ticket's detail view — full statusLabels/priorityLabels
  // wording (unlike the button's compact glyph) since this is free-form
  // message text, not a 64-byte-capped button.
  private formatTicketHeader(ticket: TicketEntity, locale: Locale): string {
    const s = BOT_STRINGS[locale];
    return [
      `№${ticket.ticketNumber} — ${ticket.title}`,
      `${s.statusHeaderLabel} ${ticket.status.key ? s.statusLabels[ticket.status.key] : ticket.status.name}`,
      `${s.priorityHeaderLabel} ${s.priorityLabels[ticket.priority]}`,
      `${s.createdHeaderLabel} ${formatDateTime(ticket.createdAt, locale)}`,
    ].join('\n');
  }

  // Fetches one page of a ticket's public (non-internal — a client must
  // never see internal notes) comment thread plus, for exactly those
  // comments, their attachments — grouped by commentId so
  // buildCommentSendJobs can interleave each one right after its own
  // comment. Scoping the attachments query to this page's comment ids
  // (rather than the whole ticket) means an attachment on a not-yet-loaded
  // older page simply shows up when that page loads via «Показать ещё»,
  // the same way its comment text already does — no separate handling
  // needed. A `commentId: null` attachment (legacy data predating the
  // column, or an orphaned upload) is never shown inline; rare enough not
  // to warrant a fallback slot.
  private async fetchCommentPageWithAttachments(
    ticketId: string,
    skip: number,
  ): Promise<{ comments: CommentEntity[]; attachmentsByComment: Map<string, AttachmentEntity[]>; totalComments: number }> {
    const [comments, totalComments] = await Promise.all([
      this.commentsRepository.find({
        where: { ticketId, isInternal: false },
        relations: ['author'],
        order: { createdAt: 'DESC' },
        skip,
        take: COMMENTS_PAGE_SIZE,
      }),
      this.commentsRepository.count({ where: { ticketId, isInternal: false } }),
    ]);

    const commentIds = comments.map((c) => c.id);
    const attachments = commentIds.length
      ? await this.attachmentsRepository.find({
          where: { commentId: In(commentIds) },
          order: { createdAt: 'ASC' },
          take: ATTACHMENTS_LIST_CAP,
        })
      : [];

    const attachmentsByComment = new Map<string, AttachmentEntity[]>();
    for (const a of attachments) {
      if (!a.commentId) continue;
      const list = attachmentsByComment.get(a.commentId);
      if (list) list.push(a);
      else attachmentsByComment.set(a.commentId, [a]);
    }
    return { comments, attachmentsByComment, totalComments };
  }

  // Turns one page of comments (+ their attachments) into the flat send
  // sequence sendCommentJobs walks — chronological order (comments arrive
  // newest-first, the natural DB query shape, reversed here so the page
  // reads top-to-bottom like a real chat transcript). A comment with text
  // gets its own message, followed by any attachments plain (no caption —
  // the preceding text message already carries the time/author context).
  // An attachment-only comment (empty body) skips a redundant "author: —"
  // text bubble entirely — that context instead becomes the FIRST
  // attachment's caption.
  private buildCommentSendJobs(
    comments: CommentEntity[],
    attachmentsByComment: Map<string, AttachmentEntity[]>,
    viewerId: string,
    locale: Locale,
  ): CommentSendJob[] {
    const s = BOT_STRINGS[locale];
    const chronological = [...comments].reverse();
    const jobs: CommentSendJob[] = [];

    for (const c of chronological) {
      const author = c.authorId === viewerId ? s.youLabel : `${s.operatorLabel}${c.author?.fullName ? ` (${c.author.fullName})` : ''}`;
      const header = `${formatDateTime(c.createdAt, locale)} · ${author}`;
      const plain = commentHtmlToTelegramText(c.body);
      const atts = attachmentsByComment.get(c.id) ?? [];

      if (plain) {
        jobs.push({ kind: 'text', text: truncate(`${header}:\n${plain}`, COMMENT_TEXT_MAX_LENGTH) });
        for (const a of atts) jobs.push({ kind: 'attachment', attachment: a });
      } else if (atts.length > 0) {
        const [first, ...rest] = atts;
        jobs.push({ kind: 'attachment', attachment: first, caption: header });
        for (const a of rest) jobs.push({ kind: 'attachment', attachment: a });
      } else {
        // Defensive: a public comment with neither body nor attachment —
        // this view has never had to handle that, keep the old em-dash
        // placeholder rather than silently dropping it from the transcript.
        jobs.push({ kind: 'text', text: `${header}:\n—` });
      }
    }
    return jobs;
  }

  // Downloads an already-stored attachment's bytes from S3 and relays them
  // to Telegram — same sendTelegramPhoto/sendTelegramDocument split by
  // content-type that attachments.service.ts#relayAttachmentToTelegram
  // already uses for a LIVE upload, just sourcing the content-type from
  // S3's stored metadata (S3Service.download, the same call the
  // authenticated web download endpoint uses) instead of a fresh multer
  // upload. No public/signed URL exists for ticket attachments (unlike
  // knowledge-base article images) and none is needed — Telegram's bytes
  // come from this app, not fetched by Telegram's own servers.
  private async sendStoredAttachment(
    chatId: string,
    token: string,
    attachment: AttachmentEntity,
    caption: string | undefined,
    replyMarkup: TelegramReplyMarkup | undefined,
  ): Promise<void> {
    const { body, contentType } = await this.s3Service.download(attachment.fileUrl);
    if (contentType.startsWith('image/')) {
      await sendTelegramPhoto(token, chatId, body, attachment.fileName, contentType, caption, replyMarkup);
    } else {
      await sendTelegramDocument(token, chatId, body, attachment.fileName, contentType, caption, replyMarkup);
    }
  }

  // Sends a flat job sequence as real, separate Telegram messages, in
  // order — the ticket-detail inline keyboard (watch toggle / show more /
  // back to list) attaches to whichever job is LAST, text or attachment,
  // so it always ends up at the bottom of the freshly-rendered view. Each
  // job is sent independently and failures are caught+logged rather than
  // aborting the rest, same defensive convention as sendArticle's own
  // segment loop — one bad file shouldn't blank out the whole ticket.
  // Accepted risk: if the LAST job happens to be an attachment and its
  // send fails, the keyboard is lost for that render; rare enough (and
  // consistent enough with how every other send failure in this file
  // already degrades) not to warrant a dedicated fallback.
  private async sendCommentJobs(
    chatId: string,
    jobs: CommentSendJob[],
    trailingKeyboard: TelegramInlineKeyboardMarkup | undefined,
  ): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const replyMarkup = i === jobs.length - 1 ? trailingKeyboard : undefined;
      if (job.kind === 'text') {
        await this.sendReply(chatId, job.text, replyMarkup);
        continue;
      }
      if (!token) continue;
      await this.sendStoredAttachment(chatId, token, job.attachment, job.caption, replyMarkup).catch((error) => {
        this.logger.warn(
          `Failed to relay stored attachment ${job.attachment.id} to Telegram: ${error instanceof Error ? error.message : error}`,
        );
      });
    }
  }

  // Assembles the inline keyboard for a ticket's detail view — watch
  // toggle always available, «Показать ещё» only when a further page of
  // comments exists, «К списку» always last so it's always in the same
  // place regardless of which other rows are present.
  private buildTicketDetailKeyboard(
    ticket: TicketEntity,
    source: TicketListSource,
    isWatching: boolean,
    hasMore: boolean,
    shownCount: number,
    locale: Locale,
  ): TelegramInlineKeyboardMarkup {
    const s = BOT_STRINGS[locale];
    const rows: TelegramInlineKeyboardButton[][] = [
      [
        {
          text: isWatching ? s.btnWatchOff : s.btnWatchOn,
          callback_data: `${TICKET_WATCH_TOGGLE_PREFIX}${ticket.id}:${source}`,
        },
      ],
    ];
    if (hasMore) {
      rows.push([{ text: s.btnShowMore, callback_data: `${TICKET_MORE_PREFIX}${ticket.id}:${source}:${shownCount}` }]);
    }
    rows.push([{ text: s.btnToList, callback_data: `${TICKET_BACK_PREFIX}${source}` }]);
    return { inline_keyboard: rows };
  }

  // Full ticket-detail view, now a real chat: a header message, then the
  // most recent page of comments each as its own message with any
  // attachments interleaved right after (see buildCommentSendJobs) —
  // opened either from a list tap (handleTicketDetailCallback) or from the
  // «Открыть тикет» button on a live outbound-reply push (see
  // chat.service.ts's use of TICKET_CALLBACK_PREFIX).
  private async sendTicketDetail(
    chatId: string,
    senderId: string,
    ticket: TicketEntity,
    source: TicketListSource,
    locale: Locale,
  ): Promise<void> {
    const s = BOT_STRINGS[locale];
    const [{ comments, attachmentsByComment, totalComments }, watcherCount] = await Promise.all([
      this.fetchCommentPageWithAttachments(ticket.id, 0),
      this.watchersRepository.count({ where: { ticketId: ticket.id, userId: senderId } }),
    ]);

    await this.sendReply(chatId, this.formatTicketHeader(ticket, locale));

    const hasMore = totalComments > comments.length;
    const keyboard = this.buildTicketDetailKeyboard(ticket, source, watcherCount > 0, hasMore, comments.length, locale);

    if (comments.length === 0) {
      await this.sendReply(chatId, s.noMessagesYetText, keyboard);
      return;
    }
    const jobs = this.buildCommentSendJobs(comments, attachmentsByComment, senderId, locale);
    await this.sendCommentJobs(chatId, jobs, keyboard);
  }

  private async handleTicketDetailCallback(chatId: string, data: string): Promise<string | undefined> {
    const [ticketId, sourceRaw] = data.split(':');
    const source = isTicketListSource(sourceRaw) ? sourceRaw : 'm';
    const sender = await this.userResolver.findByChatId(chatId);
    const locale = sender?.locale ?? Locale.RU;
    if (!sender) return BOT_STRINGS[locale].ticketNotFoundToast;
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId }, relations: ['status'] });
    // Same rule as TicketsService's getOwnedTicketOrThrow for a CLIENT
    // actor: owning the ticket (createdBy) is the entire access check —
    // watching one always implies owning it, so no separate watcher branch
    // is needed here. "Not found" and "not yours" collapse into the same
    // toast, same as that method's identical NotFoundException either way.
    if (!ticket || ticket.createdBy !== sender.id) return BOT_STRINGS[locale].ticketNotFoundToast;

    // "Real chat" UX: opening a ticket's detail is now the ONLY way a
    // client targets a specific ticket for their very next plain-text
    // message — mirrors the exact one-shot-state write the old «Ответить»
    // button used to make. Guarded on non-CLOSED the same way that button
    // was, rather than relying solely on processUpdate's own CLOSED check
    // on consumption — avoids ever arming a pending target that's already
    // known to be dead on arrival.
    if (!ticket.status.isClosed) {
      await this.usersRepository.update(
        { id: sender.id },
        { telegramPendingReplyToTicketId: ticket.id, telegramPendingNewTicket: false },
      );
    }
    await this.sendTicketDetail(chatId, sender.id, ticket, source, locale);
    return undefined;
  }

  // «Показать ещё» — loads the next older page of the same ticket's
  // conversation as its own run of messages (no header/action buttons
  // repeated), matching ordinary chat-scrollback UX. Same
  // comment+attachment interleaving as sendTicketDetail's initial page.
  private async handleTicketMoreCallback(chatId: string, data: string): Promise<string | undefined> {
    const [ticketId, sourceRaw, offsetRaw] = data.split(':');
    const source = isTicketListSource(sourceRaw) ? sourceRaw : 'm';
    const offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) return undefined;

    const sender = await this.userResolver.findByChatId(chatId);
    const locale = sender?.locale ?? Locale.RU;
    const s = BOT_STRINGS[locale];
    if (!sender) return s.ticketNotFoundToast;
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId } });
    if (!ticket || ticket.createdBy !== sender.id) return s.ticketNotFoundToast;

    const { comments, attachmentsByComment, totalComments } = await this.fetchCommentPageWithAttachments(ticket.id, offset);
    if (comments.length === 0) return s.noMoreCommentsToast;

    const hasMore = offset + comments.length < totalComments;
    const keyboard: TelegramInlineKeyboardMarkup | undefined = hasMore
      ? { inline_keyboard: [[{ text: s.btnShowMore, callback_data: `${TICKET_MORE_PREFIX}${ticket.id}:${source}:${offset + comments.length}` }]] }
      : undefined;

    const jobs = this.buildCommentSendJobs(comments, attachmentsByComment, sender.id, locale);
    await this.sendCommentJobs(chatId, jobs, keyboard);
    return undefined;
  }

  // Flips this client's watch status on the ticket, then rewrites the
  // originating message's own keyboard in place (editTelegramMessageReplyMarkup
  // replaces the whole markup, not just clears it — same call
  // handleAdminRegistrationDecision uses to strip buttons, used here to
  // relabel one instead) so the button immediately reflects the new state
  // without a fresh message.
  private async handleTicketWatchToggle(chatId: string, messageId: number, data: string): Promise<string | undefined> {
    const [ticketId, sourceRaw] = data.split(':');
    const source = isTicketListSource(sourceRaw) ? sourceRaw : 'm';
    const sender = await this.userResolver.findByChatId(chatId);
    const locale = sender?.locale ?? Locale.RU;
    const s = BOT_STRINGS[locale];
    if (!sender) return s.ticketNotFoundToast;
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId } });
    if (!ticket || ticket.createdBy !== sender.id) return s.ticketNotFoundToast;

    const wasWatching = (await this.watchersRepository.count({ where: { ticketId: ticket.id, userId: sender.id } })) > 0;
    if (wasWatching) {
      await this.watchersRepository.delete({ ticketId: ticket.id, userId: sender.id });
    } else {
      await this.watchersRepository
        .createQueryBuilder()
        .insert()
        .into(TicketWatcherEntity)
        .values({ ticketId: ticket.id, userId: sender.id })
        .orIgnore()
        .execute();
    }

    const totalComments = await this.commentsRepository.count({ where: { ticketId: ticket.id, isInternal: false } });
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      const keyboard = this.buildTicketDetailKeyboard(
        ticket,
        source,
        !wasWatching,
        totalComments > COMMENTS_PAGE_SIZE,
        Math.min(totalComments, COMMENTS_PAGE_SIZE),
        locale,
      );
      await editTelegramMessageReplyMarkup(token, chatId, messageId, keyboard).catch((error) => {
        this.logger.warn(`Failed to update watch-toggle keyboard: ${error instanceof Error ? error.message : error}`);
      });
    }
    return wasWatching ? s.watchOffToast : s.watchOnToast;
  }

  // «К списку» — re-renders whichever list this ticket's detail view was
  // opened from.
  private async handleTicketBackCallback(chatId: string, sourceRaw: string): Promise<string | undefined> {
    const source = isTicketListSource(sourceRaw) ? sourceRaw : 'm';
    const sender = await this.userResolver.findByChatId(chatId);
    const locale = sender?.locale ?? Locale.RU;
    if (!sender) return BOT_STRINGS[locale].ticketNotFoundToast;
    if (source === 'w') {
      await this.sendWatchingTickets(chatId, sender.id, locale);
    } else if (source === 'h') {
      await this.sendTicketHistory(chatId, sender.id, locale);
    } else {
      await this.sendMyTickets(chatId, sender.id, locale);
    }
    return undefined;
  }

  // Routes an inline-keyboard tap. Must always answerCallbackQuery (even on
  // a no-op path) or the tapped button shows a client-side loading spinner
  // until Telegram times it out.
  private async handleCallbackQuery(cb: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = cb.message?.chat?.id !== undefined ? String(cb.message.chat.id) : undefined;

    const adminDecisionData = cb.data?.startsWith(ADMIN_APPROVE_PREFIX) || cb.data?.startsWith(ADMIN_REJECT_PREFIX) ? cb.data : undefined;
    if (adminDecisionData) {
      const toast = chatId ? await this.handleAdminRegistrationDecision(chatId, adminDecisionData, cb) : undefined;
      if (token) {
        await answerTelegramCallbackQuery(token, cb.id, toast).catch((error) => {
          this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
        });
      }
      return;
    }

    if (cb.data?.startsWith(CSAT_CALLBACK_PREFIX)) {
      const toast = chatId ? await this.handleCsatAnswer(chatId, cb.data.slice(CSAT_CALLBACK_PREFIX.length)) : undefined;
      if (token) {
        await answerTelegramCallbackQuery(token, cb.id, toast).catch((error) => {
          this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
        });
      }
      return;
    }

    // --- Ticket-detail flow: list drill-down, pagination, reply targeting,
    // watch toggle, and back-to-list — each prefix check below resolves the
    // sender fresh and re-verifies ticket ownership every time (never
    // trusts that a callback_data value came from a legitimate list render),
    // same defensive posture as handleAdminRegistrationDecision above. ---
    if (cb.data?.startsWith(TICKET_CALLBACK_PREFIX)) {
      const toast = chatId ? await this.handleTicketDetailCallback(chatId, cb.data.slice(TICKET_CALLBACK_PREFIX.length)) : undefined;
      if (token) {
        await answerTelegramCallbackQuery(token, cb.id, toast).catch((error) => {
          this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
        });
      }
      return;
    }
    if (cb.data?.startsWith(TICKET_MORE_PREFIX)) {
      const toast = chatId ? await this.handleTicketMoreCallback(chatId, cb.data.slice(TICKET_MORE_PREFIX.length)) : undefined;
      if (token) {
        await answerTelegramCallbackQuery(token, cb.id, toast).catch((error) => {
          this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
        });
      }
      return;
    }
    if (cb.data?.startsWith(TICKET_WATCH_TOGGLE_PREFIX)) {
      const toast =
        chatId && cb.message?.message_id !== undefined
          ? await this.handleTicketWatchToggle(chatId, cb.message.message_id, cb.data.slice(TICKET_WATCH_TOGGLE_PREFIX.length))
          : undefined;
      if (token) {
        await answerTelegramCallbackQuery(token, cb.id, toast).catch((error) => {
          this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
        });
      }
      return;
    }
    if (cb.data?.startsWith(TICKET_BACK_PREFIX)) {
      const toast = chatId ? await this.handleTicketBackCallback(chatId, cb.data.slice(TICKET_BACK_PREFIX.length)) : undefined;
      if (token) {
        await answerTelegramCallbackQuery(token, cb.id, toast).catch((error) => {
          this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
        });
      }
      return;
    }

    if (token) {
      await answerTelegramCallbackQuery(token, cb.id).catch((error) => {
        this.logger.warn(`Failed to answer Telegram callback query: ${error instanceof Error ? error.message : error}`);
      });
    }
    if (!chatId || !cb.data?.startsWith(KB_CALLBACK_PREFIX)) {
      return;
    }
    const sender = await this.userResolver.findByChatId(chatId);
    await this.sendArticle(chatId, cb.data.slice(KB_CALLBACK_PREFIX.length), sender?.locale ?? Locale.RU);
  }

  // Handles a tap on TelegramAdminNotifyService's «Активировать»/«Отклонить»
  // buttons. Replicates UsersService.approve/reject's exact conditional
  // writes (approvedAt: IsNull() guard) directly against UserEntity rather
  // than calling into user-service — a genuinely separate deployable app,
  // not reachable in-process — mirroring the same cross-service
  // direct-repository pattern already used for KnowledgeArticleEntity/
  // CsatQuestionEntity elsewhere in this file. Returns a toast string for
  // answerCallbackQuery.
  private async handleAdminRegistrationDecision(
    chatId: string,
    data: string,
    cb: NonNullable<TelegramUpdate['callback_query']>,
  ): Promise<string> {
    const sender = await this.userResolver.findByChatId(chatId);
    const s = BOT_STRINGS[sender?.locale ?? Locale.RU];
    if (!sender || sender.role !== UserRole.ADMIN) {
      return s.adminNotAuthorizedToast;
    }

    const isApprove = data.startsWith(ADMIN_APPROVE_PREFIX);
    const targetUserId = data.slice((isApprove ? ADMIN_APPROVE_PREFIX : ADMIN_REJECT_PREFIX).length);

    // Same TOCTOU-safe shape as UsersRepository.setApprovedAtIfPending/
    // hardDeleteIfPending (user-service) — whichever admin's tap lands
    // first flips the `approvedAt IS NULL` predicate, so a second admin
    // (or a double-tap) affects zero rows instead of double-approving or
    // erroring. Reject is a real DELETE, not soft — matches
    // getRegistrationStatus's "missing row = rejected" semantics exactly.
    const affected = isApprove
      ? (await this.usersRepository.update({ id: targetUserId, approvedAt: IsNull() }, { approvedAt: new Date() })).affected
      : (await this.usersRepository.delete({ id: targetUserId, approvedAt: IsNull() })).affected;

    if (!affected) {
      return s.adminAlreadyHandledToast;
    }

    // Strip the buttons off THIS admin's own copy of the prompt so they
    // can't double-tap it — other admins' copies still show buttons until
    // they tap too, at which point the affected-rows check above answers
    // them with ADMIN_ALREADY_HANDLED_TOAST instead of acting twice.
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (token && cb.message?.message_id !== undefined) {
      await editTelegramMessageReplyMarkup(token, chatId, cb.message.message_id, { inline_keyboard: [] }).catch((error) => {
        this.logger.warn(`Failed to clear admin decision buttons: ${error instanceof Error ? error.message : error}`);
      });
    }

    return isApprove ? s.adminApprovedToast : s.adminRejectedToast;
  }

  // Renders an article as a sequence of Telegram messages that follows the
  // document in order — text, then an image if one comes next, then more
  // text, and so on — rather than one flattened text blob followed by every
  // image bunched at the end. Screenshots are served from a permanent
  // PUBLIC URL (knowledge-service's PublicImagesController, open for
  // anonymous /faq visitors), so Telegram can fetch each one itself; no
  // need to download bytes here and re-upload via multipart the way ticket
  // attachments' outbound relay does. Sequential awaits (not Promise.all)
  // throughout so messages land in the chat in the same order they appear
  // in the article, not whatever order concurrent requests happen to
  // resolve in.
  private async sendArticle(chatId: string, articleId: string, locale: Locale): Promise<void> {
    const article = await this.articlesRepository.findOne({
      where: { id: articleId, status: KnowledgeArticleStatus.PUBLISHED },
    });
    if (!article) {
      await this.sendReply(chatId, BOT_STRINGS[locale].articleNotFound, BACK_KEYBOARDS[locale]);
      return;
    }
    await this.articlesRepository.increment({ id: article.id }, 'viewCount', 1);

    const segments = parseArticleSegments(article.content, article.title, ARTICLE_IMAGES_CAP);
    const permalink = `${KB_ARTICLE_BASE_URL}/${article.id}`;
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLastSegment = i === segments.length - 1;
      if (segment.type === 'image') {
        if (!token) continue;
        await sendTelegramPhotoByUrl(token, chatId, segment.url).catch((error) => {
          this.logger.warn(`Failed to send article image to Telegram: ${error instanceof Error ? error.message : error}`);
        });
        continue;
      }
      if (segment.type === 'table') {
        // Not truncated (unlike the plain-text branch below) — cutting an
        // arbitrary HTML string could sever it mid-tag (e.g. before the
        // closing </pre>) and make Telegram reject the whole message; a
        // failure here is already caught by sendReply's own .catch, so a
        // pathologically large table just silently doesn't send rather than
        // risking a broken send.
        const html = isLastSegment ? `${segment.html}\n\n${escapeTelegramHtml(permalink)}` : segment.html;
        await this.sendReply(chatId, html, isLastSegment ? BACK_KEYBOARDS[locale] : undefined, 'HTML');
        continue;
      }
      // Truncated per-message (not against a shared running budget) —
      // simpler, and every real article's individual blocks are nowhere
      // near Telegram's 4096-char hard limit anyway, so this only ever
      // matters for a pathological outlier block.
      const text = truncate(isLastSegment ? `${segment.text}\n\n${permalink}` : segment.text, ARTICLE_BODY_MAX_LENGTH);
      await this.sendReply(chatId, text, isLastSegment ? BACK_KEYBOARDS[locale] : undefined);
    }

    // The article ended on an image (or had no renderable content at all) —
    // text and table segments already get the permalink appended above when
    // they're last, but an image segment never does, so send it as its own
    // final message here instead of leaving it undelivered.
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment || lastSegment.type === 'image') {
      await this.sendReply(chatId, permalink, BACK_KEYBOARDS[locale]);
    }
  }

  // Accumulates one CSAT answer at a time (CsatService.submitAnswers is
  // all-or-nothing by design — see its own comment — so a single tap can't
  // submit on its own unless it's the LAST unanswered question). Resolves
  // the target ticket fresh on every tap (the client's most recently
  // closed Telegram ticket with a still-pending survey) rather than
  // encoding a ticket id into every rating button — a uuid there alongside
  // the question uuid would overflow Telegram's 64-byte callback_data
  // limit, and this sidesteps that without losing correctness for the
  // overwhelmingly common case of one pending survey at a time. Returns an
  // optional short string shown as a toast via answerCallbackQuery.
  private async handleCsatAnswer(chatId: string, payload: string): Promise<string | undefined> {
    const [questionId, scoreStr] = payload.split(':');
    const score = Number(scoreStr);
    if (!questionId || !Number.isInteger(score) || score < 1 || score > 5) {
      return undefined;
    }

    const sender = await this.userResolver.findByChatId(chatId);
    if (!sender) {
      return undefined;
    }
    const s = BOT_STRINGS[sender.locale ?? Locale.RU];

    const pendingTicket = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .innerJoin('csat_surveys', 'survey', 'survey.ticket_id = ticket.id AND survey.submitted_at IS NULL')
      .innerJoin('ticket.status', 'status')
      .where('ticket.createdBy = :senderId', { senderId: sender.id })
      .andWhere('status.isClosed = true')
      .orderBy('ticket.closedAt', 'DESC')
      .getOne();
    if (!pendingTicket) {
      return undefined;
    }

    const enabledQuestions = await this.csatQuestionsRepository.find({ where: { isEnabled: true } });
    if (!enabledQuestions.some((q) => q.id === questionId)) {
      return undefined;
    }

    const draft = this.parseCsatDraft(sender.telegramCsatDraft);
    draft[questionId] = score;
    const answeredCount = Object.keys(draft).length;

    if (answeredCount < enabledQuestions.length) {
      await this.usersRepository.update({ id: sender.id }, { telegramCsatDraft: JSON.stringify(draft) });
      return s.csatProgressToast(answeredCount, enabledQuestions.length);
    }

    // Full set answered — submit atomically and clear the draft either way,
    // so a failed submit doesn't wedge the client into an unrecoverable
    // "always one short" state on retry.
    await this.usersRepository.update({ id: sender.id }, { telegramCsatDraft: null });
    const actor: JwtPayload = { sub: sender.id, email: sender.email, role: sender.role };
    try {
      await this.csatService.submitAnswers(
        pendingTicket.id,
        actor,
        Object.entries(draft).map(([id, score]) => ({ questionId: id, score })),
      );
      await this.sendReply(chatId, s.csatThankYou);
      return s.csatThankYou;
    } catch (error) {
      this.logger.warn(`Failed to submit Telegram CSAT answers: ${error instanceof Error ? error.message : error}`);
      return s.csatSubmitFailedToast;
    }
  }

  private parseCsatDraft(raw: string | null | undefined): Record<string, number> {
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  // Mirrors EmailIngestionService.appendReply almost exactly, including its
  // "system-authored reply" lighter notification path (no
  // AutomationTrigger.CLIENT_REPLIED — an established pattern in this
  // codebase, shared with applyAutomatedReply, not a shortcut taken here).
  // Returns the created comment so the caller can attach a file to it.
  private async appendReply(ticket: TicketEntity, authorId: string, body: string): Promise<CommentEntity> {
    const comment = this.commentsRepository.create({
      ticketId: ticket.id,
      authorId,
      body,
      isInternal: false,
    });
    const saved = await this.commentsRepository.save(comment);

    if (ticket.assignedTo) {
      await this.notificationsProducer.enqueue({
        type: NotificationType.REPLY,
        userId: ticket.assignedTo,
        ticketId: ticket.id,
      });
    }
    await this.ticketEventsPublisher.publish({
      type: 'reply',
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: toPublicTicketStatus(ticket.status),
      teamId: ticket.teamId,
      assignedTo: ticket.assignedTo,
      createdBy: ticket.createdBy,
    });
    await this.searchIndexProducer.enqueueTicket(ticket.id);

    this.logger.log(`Appended Telegram reply as a comment on ticket ${ticket.id}`);
    return saved;
  }

  // Mirrors EmailIngestionService.createTicketFromEmail's full side-effect
  // set (SLA policy, CREATED activity row, created/search-index/automation
  // publishes). Deliberate deviation: also saves the opening message as a
  // CommentEntity, which email does not do — email operators have other
  // ways to see a ticket's origin, but here the whole premise is that the
  // conversation lives in ChatPanel, so without this the client's very
  // first message would only be visible in the ticket's description field.
  // Returns both the created ticket (with its DB-assigned ticket_number)
  // and comment so the caller can include the number in the client-facing
  // confirmation and attach a file to the opening message.
  private async createTicketFromTelegram(createdBy: string, text: string): Promise<{ ticket: TicketEntity; comment: CommentEntity }> {
    const priority = TicketPriority.MEDIUM;
    const [slaPolicy, defaultStatus, defaultType] = await Promise.all([
      this.slaPoliciesRepository.findByPriority(priority),
      this.ticketStatusesRepository.findDefault(),
      this.ticketTypesRepository.findDefault(),
    ]);
    if (!defaultStatus) {
      throw new Error('No default ticket status configured');
    }
    if (!defaultType) {
      throw new Error('No default ticket type configured');
    }
    const title = text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : text;

    const ticket = this.ticketsRepository.create({
      title,
      description: text,
      statusId: defaultStatus.id,
      priority,
      typeId: defaultType.id,
      channel: TicketChannel.TELEGRAM,
      createdBy,
      externalThreadId: null,
      slaPolicyId: slaPolicy?.id ?? null,
    });
    const saved = await this.ticketsRepository.save(ticket);
    saved.status = defaultStatus;

    const activity = this.activityRepository.create({
      ticketId: saved.id,
      actorId: createdBy,
      type: TicketActivityType.CREATED,
      toValue: defaultStatus.name,
    });
    await this.activityRepository.save(activity);

    const comment = this.commentsRepository.create({
      ticketId: saved.id,
      authorId: createdBy,
      body: text,
      isInternal: false,
    });
    const savedComment = await this.commentsRepository.save(comment);

    // ticket_number is a raw-SQL sequence default — TypeORM has no column
    // metadata for it, so save()'s return value has it as undefined even
    // though the row itself is correct. Re-fetch first.
    const created = await this.ticketsRepository.findOne({ where: { id: saved.id }, relations: ['status'] });
    await Promise.all([
      this.ticketEventsPublisher.publish({
        type: 'created',
        ticketId: saved.id,
        ticketNumber: created?.ticketNumber ?? saved.ticketNumber,
        title: saved.title,
        status: toPublicTicketStatus(created?.status ?? defaultStatus),
        teamId: saved.teamId,
        assignedTo: saved.assignedTo,
        createdBy: saved.createdBy,
      }),
      this.searchIndexProducer.enqueueTicket(saved.id),
      this.automationTriggerProducer.enqueue(AutomationTrigger.TICKET_CREATED, saved.id),
    ]);

    this.logger.log(`Created ticket ${saved.id} from Telegram`);
    return { ticket: created ?? saved, comment: savedComment };
  }
}
