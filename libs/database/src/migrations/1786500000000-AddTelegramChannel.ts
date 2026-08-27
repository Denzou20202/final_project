import { MigrationInterface, QueryRunner } from "typeorm";

// Telegram bot support channel — tickets.channel distinguishes how a ticket
// entered the system (portal/email/telegram); users.telegram_chat_id is set
// on a client auto-created/matched by telegram-ingestion, used to relay
// operator replies back out. No backfill needed: 'portal' is correct for
// every pre-existing row, and telegram_chat_id is null until a Telegram
// conversation actually creates one.
export class AddTelegramChannel1786500000000 implements MigrationInterface {
    name = 'AddTelegramChannel1786500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tickets_channel_enum" AS ENUM('portal', 'email', 'telegram')`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "channel" "public"."tickets_channel_enum" NOT NULL DEFAULT 'portal'`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_channel" ON "tickets" ("channel")`);

        await queryRunner.query(`ALTER TABLE "users" ADD "telegram_chat_id" text`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_telegram_chat_id" ON "users" ("telegram_chat_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_users_telegram_chat_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_chat_id"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_channel"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "channel"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_channel_enum"`);
    }
}
