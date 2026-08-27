import { MigrationInterface, QueryRunner } from "typeorm";

// Self-service interface language (Sidebar settings → «Язык») — stored on
// the profile so it follows a person across devices, same as computerName.
export class AddUserLocale1784280000000 implements MigrationInterface {
    name = 'AddUserLocale1784280000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_locale_enum" AS ENUM('ru', 'uk', 'en')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "locale" "public"."users_locale_enum" NOT NULL DEFAULT 'ru'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
        await queryRunner.query(`DROP TYPE "public"."users_locale_enum"`);
    }
}
