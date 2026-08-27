import { MigrationInterface, QueryRunner } from "typeorm";

// Adds nullable uk/en variant columns to every admin-managed catalog whose
// single name/title/label column an admin can only ever type in one
// language at a time — see each entity's own comment (TicketStatusEntity
// .nameUk is the canonical one) for the full feature rationale. No backfill:
// existing rows stay NULL until next edited; frontends fall back to the
// base (RU) value via pickLocalized whenever a variant is null/empty, so
// nothing regresses for rows nobody has touched yet. Content fields (macro
// body, article content, custom-field options) are deliberately untouched —
// only short admin-facing labels get this treatment.
export class AddCatalogLocaleVariants1787500000000 implements MigrationInterface {
    name = 'AddCatalogLocaleVariants1787500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_statuses" ADD "name_uk" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "ticket_statuses" ADD "name_en" character varying(255)`);

        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD "label_uk" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD "label_en" character varying(255)`);

        await queryRunner.query(`ALTER TABLE "macros" ADD "title_uk" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "macros" ADD "title_en" character varying(255)`);

        await queryRunner.query(`ALTER TABLE "knowledge_articles" ADD "title_uk" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ADD "title_en" character varying(255)`);

        await queryRunner.query(`ALTER TABLE "teams" ADD "name_uk" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "teams" ADD "name_en" character varying(255)`);

        await queryRunner.query(`ALTER TABLE "tags" ADD "name_uk" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "tags" ADD "name_en" character varying(100)`);

        await queryRunner.query(`ALTER TABLE "ticket_categories" ADD "name_uk" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "ticket_categories" ADD "name_en" character varying(100)`);

        await queryRunner.query(`ALTER TABLE "employee_statuses" ADD "name_uk" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "employee_statuses" ADD "name_en" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employee_statuses" DROP COLUMN "name_en"`);
        await queryRunner.query(`ALTER TABLE "employee_statuses" DROP COLUMN "name_uk"`);

        await queryRunner.query(`ALTER TABLE "ticket_categories" DROP COLUMN "name_en"`);
        await queryRunner.query(`ALTER TABLE "ticket_categories" DROP COLUMN "name_uk"`);

        await queryRunner.query(`ALTER TABLE "tags" DROP COLUMN "name_en"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP COLUMN "name_uk"`);

        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "name_en"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "name_uk"`);

        await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN "title_en"`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN "title_uk"`);

        await queryRunner.query(`ALTER TABLE "macros" DROP COLUMN "title_en"`);
        await queryRunner.query(`ALTER TABLE "macros" DROP COLUMN "title_uk"`);

        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP COLUMN "label_en"`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP COLUMN "label_uk"`);

        await queryRunner.query(`ALTER TABLE "ticket_statuses" DROP COLUMN "name_en"`);
        await queryRunner.query(`ALTER TABLE "ticket_statuses" DROP COLUMN "name_uk"`);
    }

}
