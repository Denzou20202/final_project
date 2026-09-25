import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissionGroupReportFlags1788500000000 implements MigrationInterface {
  name = 'AddPermissionGroupReportFlags1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "permission_groups" ADD COLUMN IF NOT EXISTS "can_view_reports" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "permission_groups" ADD COLUMN IF NOT EXISTS "can_export_reports" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "permission_groups" DROP COLUMN IF EXISTS "can_export_reports"`);
    await queryRunner.query(`ALTER TABLE "permission_groups" DROP COLUMN IF EXISTS "can_view_reports"`);
  }
}
