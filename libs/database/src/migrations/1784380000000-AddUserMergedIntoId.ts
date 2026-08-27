import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserMergedIntoId1784380000000 implements MigrationInterface {
    name = 'AddUserMergedIntoId1784380000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "merged_into_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_users_merged_into_id" ON "users" ("merged_into_id")`);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_merged_into" FOREIGN KEY ("merged_into_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_merged_into"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_merged_into_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "merged_into_id"`);
    }

}
