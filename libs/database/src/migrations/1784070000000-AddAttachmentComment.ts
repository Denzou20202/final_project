import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttachmentComment1784070000000 implements MigrationInterface {
    name = 'AddAttachmentComment1784070000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Nullable — a file is uploaded (and durably stored) the moment it's
        // attached client-side, but only linked to a message once Send is
        // actually clicked. CASCADE: an attachment only makes sense in the
        // context of the message it was sent with, once it has one.
        await queryRunner.query(`ALTER TABLE "attachments" ADD "comment_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_attachments_comment_id" ON "attachments" ("comment_id")`);
        await queryRunner.query(`
            ALTER TABLE "attachments"
            ADD CONSTRAINT "FK_attachments_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_comment"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attachments_comment_id"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP COLUMN "comment_id"`);
    }

}
