import { MigrationInterface, QueryRunner } from "typeorm";

// One-shot flag for the Telegram bot's "Создать тикет" menu button — see
// UserEntity.telegramPendingNewTicket for the full behavior. NOT NULL
// DEFAULT false, same shape as is_vip: meaningless/false for every
// pre-existing row, no backfill needed.
export class AddTelegramPendingNewTicket1786700000000 implements MigrationInterface {
    name = 'AddTelegramPendingNewTicket1786700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "telegram_pending_new_ticket" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_pending_new_ticket"`);
    }
}
