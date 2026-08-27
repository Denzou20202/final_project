import { UserEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';

@Injectable()
export class TelegramUserResolverService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  // Closed-bot lookup — no auto-create. A chat.id that hasn't completed
  // /start <token> (see linkByToken) resolves to null, which
  // TelegramIngestionService.processUpdate treats as "unregistered
  // stranger, reject" rather than spawning an account.
  findByChatId(chatId: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { telegramChatId: chatId } });
  }

  // Consumes a one-time token minted by POST /users/me/telegram-link-token
  // (user-service) — proves the Telegram chat belongs to whoever generated
  // the link from their already-authenticated portal session. Returns null
  // for any invalid/expired/already-consumed token; the caller decides what
  // to tell the user. Single-use: token+expiry are cleared in the same save
  // that sets telegramChatId.
  async linkByToken(token: string, chatId: string): Promise<UserEntity | null> {
    const user = await this.usersRepository.findOne({
      where: { telegramLinkToken: token, telegramLinkTokenExpiresAt: MoreThan(new Date()) },
    });
    if (!user) {
      return null;
    }

    // telegram_chat_id is unique — if this chat was previously linked to a
    // DIFFERENT account (e.g. someone relinking the same Telegram chat
    // under a second portal login), free it first so the save below
    // doesn't hit the constraint. Effectively "this chat now belongs to
    // the account that most recently completed a link for it."
    await this.usersRepository.update({ telegramChatId: chatId, id: Not(user.id) }, { telegramChatId: null });

    user.telegramChatId = chatId;
    user.telegramLinkToken = null;
    user.telegramLinkTokenExpiresAt = null;
    return this.usersRepository.save(user);
  }
}
