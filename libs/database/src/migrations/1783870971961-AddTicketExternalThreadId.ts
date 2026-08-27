import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketExternalThreadId1783870971961 implements MigrationInterface {
    name = 'AddTicketExternalThreadId1783870971961'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "external_thread_id" text`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5ac6c4969ef9eccf0dc4c9381f" ON "tickets" ("external_thread_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_5ac6c4969ef9eccf0dc4c9381f"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "external_thread_id"`);
    }

}
