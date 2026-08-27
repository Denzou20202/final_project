import { MigrationInterface, QueryRunner } from 'typeorm';

// Retires the "New" ticket status — tickets no longer pass through a
// distinct pre-triage stage; TicketsRepository.create() now inserts every
// ticket straight into "open" (see TicketStatus in @veloxdesk/types). The
// «Неприсвоенные» (unassigned) sidebar filter takes over the "not yet
// picked up" signal that NEW used to represent.
export class DropNewTicketStatus1784420000000 implements MigrationInterface {
  name = 'DropNewTicketStatus1784420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Must run before the enum swap below — a row still holding 'new' would
    // make the USING cast fail with "invalid input value for enum".
    await queryRunner.query(`UPDATE "tickets" SET "status" = 'open' WHERE "status" = 'new'`);

    // Postgres has no ALTER TYPE ... DROP VALUE — the standard workaround is
    // a parallel enum type without the retired value, then swap the column
    // over to it.
    await queryRunner.query(
      `CREATE TYPE "public"."tickets_status_enum_new" AS ENUM('open', 'pending', 'resolved', 'closed')`,
    );
    await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "tickets" ALTER COLUMN "status" TYPE "public"."tickets_status_enum_new" USING "status"::text::"public"."tickets_status_enum_new"`,
    );
    await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'open'`);
    await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."tickets_status_enum_new" RENAME TO "tickets_status_enum"`);
  }

  // Restores the enum's 'new' value so the schema matches the old type
  // again — cannot restore which tickets were originally 'new' before up()
  // folded them into 'open', that information is gone once this runs.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tickets_status_enum_old" AS ENUM('new', 'open', 'pending', 'resolved', 'closed')`,
    );
    await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "tickets" ALTER COLUMN "status" TYPE "public"."tickets_status_enum_old" USING "status"::text::"public"."tickets_status_enum_old"`,
    );
    await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'new'`);
    await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
    await queryRunner.query(`ALTER TYPE "public"."tickets_status_enum_old" RENAME TO "tickets_status_enum"`);
  }
}
