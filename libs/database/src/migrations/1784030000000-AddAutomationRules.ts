import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAutomationRules1784030000000 implements MigrationInterface {
    name = 'AddAutomationRules1784030000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."automation_rules_trigger_enum" AS ENUM('ticket_created', 'status_changed', 'priority_changed', 'client_replied', 'sla_breached')`);
        await queryRunner.query(`
            CREATE TABLE "automation_rules" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "trigger" "public"."automation_rules_trigger_enum" NOT NULL,
                "conditions" jsonb NOT NULL DEFAULT '[]',
                "actions" jsonb NOT NULL DEFAULT '[]',
                "is_enabled" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_automation_rules_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_automation_rules_trigger_enabled" ON "automation_rules" ("trigger", "is_enabled")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_automation_rules_trigger_enabled"`);
        await queryRunner.query(`DROP TABLE "automation_rules"`);
        await queryRunner.query(`DROP TYPE "public"."automation_rules_trigger_enum"`);
    }

}
