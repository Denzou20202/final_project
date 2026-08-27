import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketCreatedOnBehalfBy1784100000000 implements MigrationInterface {
    name = 'AddTicketCreatedOnBehalfBy1784100000000'

    // Set when an operator/admin creates a ticket on behalf of a client (e.g.
    // logging a phone call) — `created_by` still points at the client so every
    // existing ownership/panel/notification path keeps working unchanged, this
    // just records which staff member actually filed it. ON DELETE SET NULL:
    // removing that staff account shouldn't take the ticket's history down.
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "created_on_behalf_by" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_created_on_behalf_by" ON "tickets" ("created_on_behalf_by")`);
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_tickets_created_on_behalf_by" FOREIGN KEY ("created_on_behalf_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_created_on_behalf_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_created_on_behalf_by"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "created_on_behalf_by"`);
    }

}
