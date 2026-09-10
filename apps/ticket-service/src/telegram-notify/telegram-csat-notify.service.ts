import { BOT_STRINGS, sendTelegramMessage } from '@veloxdesk/common';
import type { TelegramInlineKeyboardMarkup } from '@veloxdesk/common';
import { CsatQuestionEntity, TicketEntity, UserEntity } from '@veloxdesk/database';
import { Locale, TicketChannel } from '@veloxdesk/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Mirrors telegram-ingestion.service.ts's own CSAT_CALLBACK_PREFIX exactly
// — that service is what actually handles the tap, this one only builds
// the buttons. Kept as a literal duplicate rather than a shared constant:
// these two files live in genuinely separate NestJS modules within the
// same app specifically to avoid a module import cycle (see
// TelegramNotifyModule's own comment), and a two-line string constant
// isn't worth introducing a third shared module just to avoid repeating.
const CSAT_CALLBACK_PREFIX = 'csat:';
const RATING_SCORES = [1, 2, 3, 4, 5];

@Injectable()
export class TelegramCsatNotifyService {
  private readonly logger = new Logger(TelegramCsatNotifyService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(CsatQuestionEntity)
    private readonly questionsRepository: Repository<CsatQuestionEntity>,
  ) {}

  // Called by TicketsService right after a Telegram-channel ticket closes
  // (both the manual updateStatus and the automation-driven
  // applyAutomatedStatus paths — see those methods' own calls to this).
  // Mirrors client-portal's CSAT banner (ChatPanel's useCsat), but pushed
  // proactively: a chat bot has no "next time they open the app" moment
  // the way a web session does, so waiting for the client to come back and
  // notice would mean most closes never get rated at all.
  // Callers (TicketsService.updateStatus/applyAutomatedStatus) fire this
  // right after a Telegram-channel ticket closes and must never see it
  // throw — one of them awaits this BEFORE its own broadcastTicketUpdated
  // call, so an uncaught error here would silently skip that real-time
  // push entirely (this app's convention: every ticket mutation must call
  // broadcastTicketUpdated "or go stale"); the other awaits it after the
  // status change already committed, where a throw would surface as a
  // failed request for a mutation that actually succeeded. Individual
  // sendTelegramMessage calls already caught their own failures below —
  // this outer try/catch closes the gap for the DB lookups
  // (usersRepository.findOne/questionsRepository.find) that weren't.
  async notifyTicketClosed(ticket: Pick<TicketEntity, 'id' | 'ticketNumber' | 'channel' | 'createdBy'>): Promise<void> {
    try {
      await this.doNotifyTicketClosed(ticket);
    } catch (error) {
      this.logWarn('close notification', error);
    }
  }

  private async doNotifyTicketClosed(
    ticket: Pick<TicketEntity, 'id' | 'ticketNumber' | 'channel' | 'createdBy'>,
  ): Promise<void> {
    if (ticket.channel !== TicketChannel.TELEGRAM) {
      return;
    }
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return;
    }

    const client = await this.usersRepository.findOne({ where: { id: ticket.createdBy } });
    if (!client?.telegramChatId) {
      return;
    }
    const chatId = client.telegramChatId;
    const s = BOT_STRINGS[client.locale ?? Locale.RU];

    const questions = await this.questionsRepository.find({ where: { isEnabled: true }, order: { sortOrder: 'ASC' } });

    if (questions.length === 0) {
      await sendTelegramMessage(token, chatId, s.csatClosedNoQuestions(ticket.ticketNumber)).catch((error) =>
        this.logWarn('close notification', error),
      );
      return;
    }

    await sendTelegramMessage(token, chatId, s.csatClosedWithQuestions(ticket.ticketNumber)).catch((error) =>
      this.logWarn('close notification', error),
    );

    // One message per question, each with its own 1–5 row — matches how
    // telegram-ingestion.service.ts's handleCsatAnswer accumulates answers
    // one tap at a time (CsatService.submitAnswers is all-or-nothing, so a
    // single combined message couldn't submit partway through anyway).
    for (const question of questions) {
      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          RATING_SCORES.map((score) => ({
            text: String(score),
            callback_data: `${CSAT_CALLBACK_PREFIX}${question.id}:${score}`,
          })),
        ],
      };
      await sendTelegramMessage(token, chatId, question.text, keyboard).catch((error) => this.logWarn('CSAT question', error));
    }
  }

  private logWarn(what: string, error: unknown): void {
    this.logger.warn(`Failed to send Telegram ${what}: ${error instanceof Error ? error.message : error}`);
  }
}
