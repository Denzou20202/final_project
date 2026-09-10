import { MigrationInterface, QueryRunner } from 'typeorm';

// Enterprise directory auth (LDAP/OIDC) — see UserEntity.authProvider/
// externalId. password_hash is relaxed to nullable since directory-
// provisioned/linked accounts never have a local password; every
// pre-existing row keeps its hash and gets auth_provider = 'local' for free
// via the column default.
export class AddUserDirectoryAuth1787700000000 implements MigrationInterface {
  name = 'AddUserDirectoryAuth1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."users_auth_provider_enum" AS ENUM('local', 'ldap', 'oidc')`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "auth_provider" "public"."users_auth_provider_enum" NOT NULL DEFAULT 'local'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "external_id" character varying(255)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_auth_provider_external_id" ON "users" ("auth_provider", "external_id") WHERE "external_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_auth_provider_external_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "external_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "auth_provider"`);
    await queryRunner.query(`DROP TYPE "public"."users_auth_provider_enum"`);
    // Not restoring NOT NULL on password_hash: any row that went null while
    // this migration was applied would break the rollback.
  }
}
