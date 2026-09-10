import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKnowledgeStatsAndTheme1784390000000 implements MigrationInterface {
    name = 'AddKnowledgeStatsAndTheme1784390000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ADD "view_count" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ADD "helpful_count" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ADD "not_helpful_count" integer NOT NULL DEFAULT 0`);

        await queryRunner.query(`
            CREATE TABLE "knowledge_theme" (
                "id" smallint NOT NULL,
                "custom_css" text,
                "custom_js" text,
                CONSTRAINT "PK_knowledge_theme_id" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "knowledge_theme"`);

        await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN "not_helpful_count"`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN "helpful_count"`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN "view_count"`);
    }

}
