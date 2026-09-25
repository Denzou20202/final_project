import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRefreshTokenHashes1788600000000 implements MigrationInterface {
  name = 'AddUserRefreshTokenHashes1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "refresh_token_hashes" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(
      `UPDATE "users" SET "refresh_token_hashes" = ARRAY["refresh_token_hash"] WHERE "refresh_token_hash" IS NOT NULL AND "refresh_token_hash" != ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refresh_token_hashes"`);
  }
}
