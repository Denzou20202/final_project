import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketSlaPauseTracking1788400000000 implements MigrationInterface {
  name = 'AddTicketSlaPauseTracking1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN "paused_duration_min" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD COLUMN "sla_paused_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "sla_paused_at"`);
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "paused_duration_min"`);
  }
}
