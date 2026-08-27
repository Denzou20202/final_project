import { MigrationInterface, QueryRunner } from "typeorm";

// Backs the report builder's "KPI as a weighted sum by ticket type" column —
// exactly one row per TicketType, seeded here with weight=1 (neutral — every
// type counts equally until an admin customizes it via Настройки → Веса KPI).
export class AddTicketTypeWeights1784340000000 implements MigrationInterface {
    name = 'AddTicketTypeWeights1784340000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ticket_type_weights_type_enum" AS ENUM('incident', 'service_request', 'problem', 'question')`);
        await queryRunner.query(`CREATE TABLE "ticket_type_weights" ("type" "public"."ticket_type_weights_type_enum" NOT NULL, "weight" integer NOT NULL DEFAULT 1, CONSTRAINT "PK_ticket_type_weights_type" PRIMARY KEY ("type"))`);
        await queryRunner.query(`INSERT INTO "ticket_type_weights" ("type", "weight") VALUES ('incident', 1), ('service_request', 1), ('problem', 1), ('question', 1)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ticket_type_weights"`);
        await queryRunner.query(`DROP TYPE "public"."ticket_type_weights_type_enum"`);
    }
}
