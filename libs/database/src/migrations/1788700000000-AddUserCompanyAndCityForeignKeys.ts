import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCompanyAndCityForeignKeys1788700000000 implements MigrationInterface {
  name = 'AddUserCompanyAndCityForeignKeys1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "company_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "city_id" uuid NULL`);

    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_company_id" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_city_id" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`CREATE INDEX "IDX_users_company_id" ON "users" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_city_id" ON "users" ("city_id")`);

    // Backfill relational FKs from existing company / city names
    await queryRunner.query(`
      UPDATE "users" u
      SET "company_id" = c."id"
      FROM "companies" c
      WHERE u."company" IS NOT NULL AND LOWER(TRIM(u."company")) = LOWER(TRIM(c."name"))
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "city_id" = ct."id"
      FROM "cities" ct
      WHERE u."city" IS NOT NULL AND LOWER(TRIM(u."city")) = LOWER(TRIM(ct."name"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_city_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_company_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_city_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_company_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "company_id"`);
  }
}
