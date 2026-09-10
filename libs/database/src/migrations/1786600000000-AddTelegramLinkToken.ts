import { MigrationInterface, QueryRunner } from "typeorm";

// One-time Telegram account-linking token — issued by
// UsersService.createTelegramLinkToken (POST /users/me/telegram-link-token)
// and consumed by TelegramUserResolverService.linkByToken when the client
// taps the resulting t.me deep link. Single-use: both columns are cleared
// in the same save that sets telegram_chat_id, and generating a fresh
// token overwrites whatever was previously pending — no separate
// revocation bookkeeping needed. Nullable + unique, same shape as
// telegram_chat_id (migration 1786500000000).
export class AddTelegramLinkToken1786600000000 implements MigrationInterface {
    name = 'AddTelegramLinkToken1786600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "telegram_link_token" text`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_telegram_link_token" ON "users" ("telegram_link_token")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "telegram_link_token_expires_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_link_token_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_telegram_link_token"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_link_token"`);
    }
}
