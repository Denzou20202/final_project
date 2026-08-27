import { MigrationInterface, QueryRunner } from "typeorm";

// One-shot target for the Telegram bot's per-ticket "Ответить" button — see
// UserEntity.telegramPendingReplyToTicketId for the full behavior. NULL for
// every pre-existing row, no backfill needed. No FK: a stale/dangling id
// (ticket deleted between the tap and the next message) is handled in
// application code by falling back gracefully, not by a DB constraint.
export class AddTelegramPendingReplyToTicket1787000000000 implements MigrationInterface {
    name = 'AddTelegramPendingReplyToTicket1787000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "telegram_pending_reply_to_ticket_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_pending_reply_to_ticket_id"`);
    }
}
