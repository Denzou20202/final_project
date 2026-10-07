import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketSlaPolicyAssignedAt1788800000000 implements MigrationInterface {
  name = 'AddTicketSlaPolicyAssignedAt1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN "sla_policy_assigned_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "tickets" SET "sla_policy_assigned_at" = "created_at" WHERE "sla_policy_id" IS NOT NULL AND "sla_policy_assigned_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "sla_policy_assigned_at"`);
  }
}
