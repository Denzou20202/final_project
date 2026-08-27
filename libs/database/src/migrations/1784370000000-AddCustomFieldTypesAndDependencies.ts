import { MigrationInterface, QueryRunner } from "typeorm";

// Спринт 18 — new field types (textarea/checkbox/file/regex) + a single
// dependsOnField link that backs both conditional visibility and
// hierarchical (parent→child) SELECT options.
export class AddCustomFieldTypesAndDependencies1784370000000 implements MigrationInterface {
    name = 'AddCustomFieldTypesAndDependencies1784370000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."custom_field_definitions_field_type_enum" ADD VALUE 'textarea'`);
        await queryRunner.query(`ALTER TYPE "public"."custom_field_definitions_field_type_enum" ADD VALUE 'checkbox'`);
        await queryRunner.query(`ALTER TYPE "public"."custom_field_definitions_field_type_enum" ADD VALUE 'file'`);
        await queryRunner.query(`ALTER TYPE "public"."custom_field_definitions_field_type_enum" ADD VALUE 'regex'`);

        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD "pattern" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD "depends_on_field_id" uuid`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD "condition_value" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD "options_by_parent" jsonb`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "FK_custom_field_definitions_depends_on" FOREIGN KEY ("depends_on_field_id") REFERENCES "custom_field_definitions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP CONSTRAINT "FK_custom_field_definitions_depends_on"`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP COLUMN "options_by_parent"`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP COLUMN "condition_value"`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP COLUMN "depends_on_field_id"`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP COLUMN "pattern"`);
        // Postgres has no DROP VALUE for enums — same rationale as every
        // prior migration in this file's lineage.
    }
}
