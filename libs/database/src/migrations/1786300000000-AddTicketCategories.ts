import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketCategories1786300000000 implements MigrationInterface {
    name = 'AddTicketCategories1786300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- ticket_categories ---
        await queryRunner.query(`
            CREATE TABLE "ticket_categories" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_categories_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_categories_name" ON "ticket_categories" ("name")`);

        // --- tickets.category_id ---
        await queryRunner.query(`ALTER TABLE "tickets" ADD "category_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_category_id" ON "tickets" ("category_id")`);
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_tickets_category" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_category_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "category_id"`);

        await queryRunner.query(`DROP TABLE "ticket_categories"`);
    }

}
