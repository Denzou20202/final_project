import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArticleIsPublic1787100000000 implements MigrationInterface {
    name = 'AddArticleIsPublic1787100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ADD "is_public" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN "is_public"`);
    }

}
