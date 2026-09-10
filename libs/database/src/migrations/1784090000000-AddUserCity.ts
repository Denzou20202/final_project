import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserCity1784090000000 implements MigrationInterface {
    name = 'AddUserCity1784090000000'

    // Forgotten field from AddUserProfileFields1784080000000 — same
    // nullable free-text pattern as the rest of that profile card.
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "city" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city"`);
    }

}
