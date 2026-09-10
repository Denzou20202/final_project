import { MigrationInterface, QueryRunner } from 'typeorm';

// Admin-toggleable "VIP client" flag — meaningful only when role = CLIENT.
// Surfaced as a red sheriff-star badge next to the client's name wherever
// operators see it (ticket list, ticket detail's client panel, the
// create-ticket client picker, the Users admin list). See
// UsersService.setVip / EditUserModal.tsx.
export class AddUserIsVip1784450000000 implements MigrationInterface {
  name = 'AddUserIsVip1784450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "is_vip" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_vip"`);
  }
}
