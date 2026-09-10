import { MigrationInterface, QueryRunner } from 'typeorm';

// Gates the new "admin must approve self-registration" feature — see
// UserEntity.approvedAt for the column-level contract.
export class AddUserApprovedAt1784400000000 implements MigrationInterface {
  name = 'AddUserApprovedAt1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "approved_at" TIMESTAMP WITH TIME ZONE`);
    // There was no approval gate before this feature — every pre-existing
    // account was already, in effect, approved the moment it was created.
    await queryRunner.query(`UPDATE "users" SET "approved_at" = "created_at" WHERE "approved_at" IS NULL`);
    // Partial index: only ever-pending rows are indexed, so this stays tiny
    // regardless of total user count — exactly what the admin pending-list
    // query (WHERE approved_at IS NULL ORDER BY created_at) needs.
    await queryRunner.query(
      `CREATE INDEX "IDX_users_pending" ON "users" ("created_at") WHERE "approved_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_pending"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "approved_at"`);
  }
}
