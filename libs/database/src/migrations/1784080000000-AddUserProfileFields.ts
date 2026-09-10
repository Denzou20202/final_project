import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileFields1784080000000 implements MigrationInterface {
    name = 'AddUserProfileFields1784080000000'

    // All nullable, all free text — organizational context about the
    // person (workstation asset tag, job info), entered by an admin via the
    // Users page and surfaced read-only in a ticket's «Клиент» panel.
    // Deliberately NOT the same thing as the existing `teams` entity (which
    // routes tickets to a support queue) — "Отдел"/"Подразделение" here
    // describe the CLIENT's own company org chart.
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "computer_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "position" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "department" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "subdivision" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subdivision"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "department"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "position"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "computer_name"`);
    }

}
