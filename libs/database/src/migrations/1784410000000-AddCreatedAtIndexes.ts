import { MigrationInterface, QueryRunner } from 'typeorm';

// `created_at` is the default sort field for the ticket list, and the
// column reports filter/join `comments`/`ticket_activities` by date range —
// none of the three had an index before this. Cheap, safe addition; no
// existing query behavior changes, just what's index-backed.
export class AddCreatedAtIndexes1784410000000 implements MigrationInterface {
  name = 'AddCreatedAtIndexes1784410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_tickets_created_at" ON "tickets" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_comments_created_at" ON "comments" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_ticket_activities_created_at" ON "ticket_activities" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ticket_activities_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_created_at"`);
  }
}
