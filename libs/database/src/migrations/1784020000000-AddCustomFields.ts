import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomFields1784020000000 implements MigrationInterface {
    name = 'AddCustomFields1784020000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."custom_field_definitions_field_type_enum" AS ENUM('text', 'number', 'date', 'select')`);
        await queryRunner.query(`
            CREATE TABLE "custom_field_definitions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "label" character varying(255) NOT NULL,
                "field_type" "public"."custom_field_definitions_field_type_enum" NOT NULL,
                "options" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_custom_field_definitions_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "ticket_custom_field_values" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_id" uuid NOT NULL,
                "field_id" uuid NOT NULL,
                "value" text NOT NULL,
                CONSTRAINT "PK_ticket_custom_field_values_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_custom_field_values_ticket_field" ON "ticket_custom_field_values" ("ticket_id", "field_id")`);
        await queryRunner.query(`
            ALTER TABLE "ticket_custom_field_values"
            ADD CONSTRAINT "FK_ticket_custom_field_values_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "ticket_custom_field_values"
            ADD CONSTRAINT "FK_ticket_custom_field_values_field" FOREIGN KEY ("field_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_custom_field_values" DROP CONSTRAINT "FK_ticket_custom_field_values_field"`);
        await queryRunner.query(`ALTER TABLE "ticket_custom_field_values" DROP CONSTRAINT "FK_ticket_custom_field_values_ticket"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ticket_custom_field_values_ticket_field"`);
        await queryRunner.query(`DROP TABLE "ticket_custom_field_values"`);
        await queryRunner.query(`DROP TABLE "custom_field_definitions"`);
        await queryRunner.query(`DROP TYPE "public"."custom_field_definitions_field_type_enum"`);
    }

}
