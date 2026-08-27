import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketNumber1784000000000 implements MigrationInterface {
    name = 'AddTicketNumber1784000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE "tickets_ticket_number_seq"`);
        // DEFAULT nextval(...) backfills every existing row with a sequential
        // number in one pass (Postgres rewrites the table since nextval() is
        // volatile) — fine at this app's scale, and the sequence is already
        // correctly advanced afterwards for new inserts, no separate setval.
        await queryRunner.query(
            `ALTER TABLE "tickets" ADD "ticket_number" integer NOT NULL DEFAULT nextval('tickets_ticket_number_seq')`,
        );
        await queryRunner.query(`ALTER SEQUENCE "tickets_ticket_number_seq" OWNED BY "tickets"."ticket_number"`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_tickets_ticket_number" ON "tickets" ("ticket_number")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_tickets_ticket_number"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "ticket_number"`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS "tickets_ticket_number_seq"`);
    }

}
