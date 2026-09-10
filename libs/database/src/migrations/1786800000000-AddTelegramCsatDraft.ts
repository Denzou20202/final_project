import { MigrationInterface, QueryRunner } from "typeorm";

// Holds in-progress Telegram-bot CSAT answers until the full question set
// is answered (see UserEntity.telegramCsatDraft). NULL for every
// pre-existing row — nothing to backfill.
export class AddTelegramCsatDraft1786800000000 implements MigrationInterface {
    name = 'AddTelegramCsatDraft1786800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "telegram_csat_draft" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_csat_draft"`);
    }
}
