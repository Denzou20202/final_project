import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketTypeMergeTagsWatchers1784040000000 implements MigrationInterface {
    name = 'AddTicketTypeMergeTagsWatchers1784040000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- tickets.type ---
        await queryRunner.query(`CREATE TYPE "public"."tickets_type_enum" AS ENUM('incident', 'service_request', 'problem', 'question')`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "type" "public"."tickets_type_enum" NOT NULL DEFAULT 'service_request'`);

        // --- tickets.merged_into_id (self-referencing FK) ---
        await queryRunner.query(`ALTER TABLE "tickets" ADD "merged_into_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_merged_into_id" ON "tickets" ("merged_into_id")`);
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_tickets_merged_into" FOREIGN KEY ("merged_into_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        // --- tags ---
        await queryRunner.query(`
            CREATE TABLE "tags" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tags_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_tags_name" ON "tags" ("name")`);

        // --- ticket_tags ---
        await queryRunner.query(`
            CREATE TABLE "ticket_tags" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_id" uuid NOT NULL,
                "tag_id" uuid NOT NULL,
                CONSTRAINT "PK_ticket_tags_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_tags_ticket_tag" ON "ticket_tags" ("ticket_id", "tag_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_tags_tag_id" ON "ticket_tags" ("tag_id")`);
        await queryRunner.query(`
            ALTER TABLE "ticket_tags"
            ADD CONSTRAINT "FK_ticket_tags_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "ticket_tags"
            ADD CONSTRAINT "FK_ticket_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // --- ticket_watchers ---
        await queryRunner.query(`
            CREATE TABLE "ticket_watchers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_watchers_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_watchers_ticket_user" ON "ticket_watchers" ("ticket_id", "user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_watchers_user_id" ON "ticket_watchers" ("user_id")`);
        await queryRunner.query(`
            ALTER TABLE "ticket_watchers"
            ADD CONSTRAINT "FK_ticket_watchers_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "ticket_watchers"
            ADD CONSTRAINT "FK_ticket_watchers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_watchers" DROP CONSTRAINT "FK_ticket_watchers_user"`);
        await queryRunner.query(`ALTER TABLE "ticket_watchers" DROP CONSTRAINT "FK_ticket_watchers_ticket"`);
        await queryRunner.query(`DROP TABLE "ticket_watchers"`);

        await queryRunner.query(`ALTER TABLE "ticket_tags" DROP CONSTRAINT "FK_ticket_tags_tag"`);
        await queryRunner.query(`ALTER TABLE "ticket_tags" DROP CONSTRAINT "FK_ticket_tags_ticket"`);
        await queryRunner.query(`DROP TABLE "ticket_tags"`);

        await queryRunner.query(`DROP TABLE "tags"`);

        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_merged_into"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_merged_into_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "merged_into_id"`);

        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_type_enum"`);
    }

}
