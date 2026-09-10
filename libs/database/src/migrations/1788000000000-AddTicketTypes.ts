import { MigrationInterface, QueryRunner } from "typeorm";

// Replaces the fixed 4-value "tickets"."type" enum with a lookup table
// (ticket_types) so admins can create/edit/delete their own ticket types —
// same "parallel structure -> backfill -> swap -> drop old" shape
// AddTicketStatuses1787200000000 used for status, applied here to type. Also
// folds in the separate ticket_type_weights table (see
// AddTicketTypeWeights1784340000000): that table assumed exactly 4
// immutable rows keyed by the enum, which breaks the moment types become
// admin-creatable, so `weight` becomes a plain column on ticket_types
// instead. The 4 fixed ids below MUST match
// libs/types/src/lib/seeded-ticket-type-ids.ts's SEEDED_TICKET_TYPE_IDS by
// hand — same caveat as SEEDED_TICKET_STATUS_IDS/SYSTEM_USER_ID.
const INCIDENT_ID = '00000000-0000-4000-8000-000000000201';
const SERVICE_REQUEST_ID = '00000000-0000-4000-8000-000000000202';
const PROBLEM_ID = '00000000-0000-4000-8000-000000000203';
const QUESTION_ID = '00000000-0000-4000-8000-000000000204';

export class AddTicketTypes1788000000000 implements MigrationInterface {
    name = 'AddTicketTypes1788000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ticket_types" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" character varying(20),
                "name" character varying(255) NOT NULL,
                "name_uk" character varying(255),
                "name_en" character varying(255),
                "color" character varying(7) NOT NULL,
                "is_default" boolean NOT NULL DEFAULT false,
                "weight" integer NOT NULL DEFAULT 1,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_types_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_types_key" ON "ticket_types" ("key")`);
        // Belt-and-suspenders for the app-level isDefault-exclusivity check
        // (TicketTypesService), same as ticket_statuses' equivalent index.
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_ticket_types_single_default" ON "ticket_types" ("is_default") WHERE "is_default" = true`,
        );

        await queryRunner.query(`
            INSERT INTO "ticket_types" ("id", "key", "name", "color", "is_default", "weight", "sort_order") VALUES
                ('${INCIDENT_ID}', 'incident', 'Инцидент', '#D64545', false, 1, 1),
                ('${SERVICE_REQUEST_ID}', 'service_request', 'Запрос на обслуживание', '#4C82F7', true, 1, 2),
                ('${PROBLEM_ID}', 'problem', 'Проблема', '#E68A2E', false, 1, 3),
                ('${QUESTION_ID}', 'question', 'Вопрос', '#8A6FE0', false, 1, 4)
        `);

        // Carry over any admin-customized weight from the old side table
        // before it's dropped below — most installs never touched it (every
        // row seeded weight=1), but this preserves the ones that did.
        await queryRunner.query(`
            UPDATE "ticket_types" SET "weight" = ttw."weight"
            FROM "ticket_type_weights" ttw WHERE ttw."type"::text = "ticket_types"."key"
        `);

        await queryRunner.query(`ALTER TABLE "tickets" ADD "type_id" uuid`);
        await queryRunner.query(`
            UPDATE "tickets" SET "type_id" = (CASE "type"
                WHEN 'incident' THEN '${INCIDENT_ID}'
                WHEN 'service_request' THEN '${SERVICE_REQUEST_ID}'
                WHEN 'problem' THEN '${PROBLEM_ID}'
                WHEN 'question' THEN '${QUESTION_ID}'
            END)::uuid
        `);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "type_id" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_type_id" ON "tickets" ("type_id")`);
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_tickets_type" FOREIGN KEY ("type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);

        // Drops the old enum column (and, as a side effect, its own index —
        // Postgres cascades index drops for columns dropped this way) and the
        // now-unused enum type itself.
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_type_enum"`);

        // The old fixed-4-rows weights table is now fully superseded by
        // ticket_types.weight above.
        await queryRunner.query(`DROP TABLE "ticket_type_weights"`);
        await queryRunner.query(`DROP TYPE "public"."ticket_type_weights_type_enum"`);
    }

    // Restores the enum column and the old weights side table so the schema
    // matches the pre-migration shape again. Cannot restore per-ticket
    // accuracy for anything that was ever moved to a custom (non-seeded)
    // type — those fold to 'service_request', same "information is gone"
    // caveat AddTicketStatuses1787200000000's down() documents. Weights for
    // any custom type are lost the same way.
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tickets_type_enum" AS ENUM('incident', 'service_request', 'problem', 'question')`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "type" "public"."tickets_type_enum"`);
        await queryRunner.query(`
            UPDATE "tickets" t SET "type" = COALESCE(tt."key", 'service_request')::"public"."tickets_type_enum"
            FROM "ticket_types" tt WHERE tt."id" = t."type_id"
        `);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "type" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "type" SET DEFAULT 'service_request'`);

        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_type_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "type_id"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_ticket_types_single_default"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ticket_types_key"`);
        await queryRunner.query(`DROP TABLE "ticket_types"`);

        await queryRunner.query(`CREATE TYPE "public"."ticket_type_weights_type_enum" AS ENUM('incident', 'service_request', 'problem', 'question')`);
        await queryRunner.query(`CREATE TABLE "ticket_type_weights" ("type" "public"."ticket_type_weights_type_enum" NOT NULL, "weight" integer NOT NULL DEFAULT 1, CONSTRAINT "PK_ticket_type_weights_type" PRIMARY KEY ("type"))`);
        await queryRunner.query(`INSERT INTO "ticket_type_weights" ("type", "weight") VALUES ('incident', 1), ('service_request', 1), ('problem', 1), ('question', 1)`);
    }

}
