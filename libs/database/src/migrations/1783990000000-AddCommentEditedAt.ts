import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommentEditedAt1783990000000 implements MigrationInterface {
    name = 'AddCommentEditedAt1783990000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" ADD "edited_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "edited_at"`);
    }

}
