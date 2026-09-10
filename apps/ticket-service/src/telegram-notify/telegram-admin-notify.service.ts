import { sendTelegramMessage } from '@veloxdesk/common';
import type { TelegramInlineKeyboardMarkup } from '@veloxdesk/common';
import { UserEntity } from '@veloxdesk/database';
import { UserRole } from '@veloxdesk/types';
import type { RegistrationPendingEvent } from '@veloxdesk/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

// Mirrors telegram-ingestion.service.ts's own ADMIN_APPROVE_PREFIX/
// ADMIN_REJECT_PREFIX exactly — that service is what actually handles the
// tap, this one only builds the buttons. Duplicated rather than shared for
// the same reason as the CSAT callback prefix: these two files live in
// separate concerns specifically to avoid coupling the notify-on-event path
// to the webhook-handling path, and a two-line string constant isn't worth
// a shared module for.
const ADMIN_APPROVE_PREFIX = 'admin:approve:';
const ADMIN_REJECT_PREFIX = 'admin:reject:';

@Injectable()
export class TelegramAdminNotifyService {
  private readonly logger = new Logger(TelegramAdminNotifyService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  // Called by TelegramUserEventsSubscriberService on every
  // 'registration_pending' event (the same Redis pub/sub broadcast
  // chat-service's own subscriber already relays to connected admins'
  // browser tabs — this is a second, independent subscriber on the same
  // channel, not a replacement). Solves the "admin isn't at their PC"
  // gap: that in-app bell only works while a tab is open and connected,
  // this reaches a phone.
  // The caller (TelegramUserEventsSubscriberService) fires this with
  // `void ...notifyRegistrationPending(payload)` and no .catch — this
  // service has no process-level unhandledRejection handler either, so an
  // uncaught throw here (a transient DB blip on the usersRepository.find
  // below, for instance) becomes an unhandled promise rejection that kills
  // the entire ticket-service process (default Node behavior since v15).
  // The individual sendTelegramMessage calls already caught their own
  // failures — this outer try/catch closes the gap for everything else.
  async notifyRegistrationPending(event: RegistrationPendingEvent): Promise<void> {
    try {
      await this.doNotifyRegistrationPending(event);
    } catch (error) {
      this.logger.warn(
        `Failed to notify admins of pending registration ${event.userId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async doNotifyRegistrationPending(event: RegistrationPendingEvent): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    const admins = await this.usersRepository.find({
      where: { role: UserRole.ADMIN, telegramChatId: Not(IsNull()) },
    });
    if (admins.length === 0) return;

    const text = `Новый пользователь ожидает подтверждения:\n${event.fullName} (${event.email})`;
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Активировать', callback_data: `${ADMIN_APPROVE_PREFIX}${event.userId}` },
          { text: '❌ Отклонить', callback_data: `${ADMIN_REJECT_PREFIX}${event.userId}` },
        ],
      ],
    };

    await Promise.all(
      admins
        .filter((admin): admin is UserEntity & { telegramChatId: string } => !!admin.telegramChatId)
        .map((admin) =>
          sendTelegramMessage(token, admin.telegramChatId, text, keyboard).catch((error) => {
            this.logger.warn(
              `Failed to notify admin ${admin.id} of pending registration: ${error instanceof Error ? error.message : error}`,
            );
          }),
        ),
    );
  }
}
