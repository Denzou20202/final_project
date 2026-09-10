import { MigrationInterface, QueryRunner } from "typeorm";

// «Глобальный аудит настроек» — who changed SLA policies/permission groups/
// custom fields/automation rules, and when. Distinct from ticket_activities
// (per-ticket actions). No FK on entity_id — unlike tickets, all 4 target
// entities can be hard-deleted, and the log must survive that.
export class AddSettingsAuditLog1784360000000 implements MigrationInterface {
    name = 'AddSettingsAuditLog1784360000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."settings_audit_log_module_enum" AS ENUM('sla_policy', 'permission_group', 'custom_field', 'automation_rule')`);
        await queryRunner.query(`CREATE TYPE "public"."settings_audit_log_event_type_enum" AS ENUM('created', 'updated', 'deleted')`);
        await queryRunner.query(`CREATE TABLE "settings_audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "module" "public"."settings_audit_log_module_enum" NOT NULL, "event_type" "public"."settings_audit_log_event_type_enum" NOT NULL, "entity_id" uuid, "entity_label" character varying(255) NOT NULL, "changes" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_settings_audit_log_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_settings_audit_log_actor_id" ON "settings_audit_log" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_settings_audit_log_module" ON "settings_audit_log" ("module") `);
        await queryRunner.query(`CREATE INDEX "IDX_settings_audit_log_created_at" ON "settings_audit_log" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "settings_audit_log" ADD CONSTRAINT "FK_settings_audit_log_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings_audit_log" DROP CONSTRAINT "FK_settings_audit_log_actor_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_settings_audit_log_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_settings_audit_log_module"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_settings_audit_log_actor_id"`);
        await queryRunner.query(`DROP TABLE "settings_audit_log"`);
        await queryRunner.query(`DROP TYPE "public"."settings_audit_log_event_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."settings_audit_log_module_enum"`);
    }
}
