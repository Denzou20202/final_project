import { MigrationInterface, QueryRunner } from 'typeorm';

// Backs the "restricted admin" account type — an ADMIN who can see and
// manage everything a normal admin can EXCEPT other ADMIN accounts (can't
// create one, can't touch an existing one's role/password/status/profile).
// One-directional: a normal (unrestricted) admin can still fully manage a
// restricted admin's own account. See UsersService.assertAdminActionAllowed.
export class AddCannotManageAdmins1784430000000 implements MigrationInterface {
  name = 'AddCannotManageAdmins1784430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "cannot_manage_admins" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "cannot_manage_admins"`);
  }
}
