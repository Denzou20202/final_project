import { MigrationInterface, QueryRunner } from 'typeorm';

// Gates the new mandatory client-onboarding form — see
// UserEntity.profileCompletedAt for the column-level contract.
export class AddUserProfileCompletedAt1784440000000 implements MigrationInterface {
  name = 'AddUserProfileCompletedAt1784440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "profile_completed_at" TIMESTAMP WITH TIME ZONE`);
    // Only NEW registrations should ever see the onboarding form — every
    // account that predates this feature is backfilled to its createdAt,
    // the same approach already used for approved_at above.
    await queryRunner.query(`UPDATE "users" SET "profile_completed_at" = "created_at" WHERE "profile_completed_at" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profile_completed_at"`);
  }
}
