import { sendTelegramMessage } from '@veloxdesk/common';
import type { TelegramInlineKeyboardMarkup } from '@veloxdesk/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramOutboundService {
  private readonly logger = new Logger(TelegramOutboundService.name);

  constructor(private readonly config: ConfigService) {}

  // Fire-and-forget by design — called from postMessage() below, which must
  // not add Telegram's network round trip to every operator reply's
  // WebSocket ack. The CommentEntity write already succeeded before this
  // runs, so a failed/delayed Telegram push never loses data, only delays
  // the client seeing it — same best-effort tradeoff this codebase already
  // makes for ticketEventsPublisher's Redis pub/sub.
  //
  // `text` is expected to already be Telegram-flavored HTML (see
  // commentHtmlToTelegramHtml/escapeTelegramHtml) — always sent with
  // parse_mode: 'HTML' so bold/italic/links an operator typed survive as
  // real formatting instead of literal tags. `replyMarkup`, when given,
  // attaches a «Открыть тикет» deep-link button (see chat.service.ts) so a
  // client with several tickets pushing into the same Telegram DM can tell
  // which one this message belongs to and jump straight to its detail view.
  relay(chatId: string, text: string, replyMarkup?: TelegramInlineKeyboardMarkup): void {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return; // outbound relay not configured — inbound still works, it just can't reply

    void sendTelegramMessage(token, chatId, text, replyMarkup, 'HTML').catch((error) => {
      this.logger.warn(`Telegram sendMessage failed: ${error instanceof Error ? error.message : error}`);
    });
  }
}
