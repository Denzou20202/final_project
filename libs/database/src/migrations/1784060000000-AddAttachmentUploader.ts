import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttachmentUploader1784060000000 implements MigrationInterface {
    name = 'AddAttachmentUploader1784060000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Nullable — historical attachments have no known uploader, and the
        // app renders those as a neutral (non-aligned) card rather than
        // guessing. ON DELETE SET NULL: deleting a user shouldn't take their
        // past uploads' file/ticket history down with them.
        await queryRunner.query(`ALTER TABLE "attachments" ADD "uploader_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_attachments_uploader_id" ON "attachments" ("uploader_id")`);
        await queryRunner.query(`
            ALTER TABLE "attachments"
            ADD CONSTRAINT "FK_attachments_uploader" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_attachments_uploader"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attachments_uploader_id"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP COLUMN "uploader_id"`);
    }

}
