import { MigrationInterface, QueryRunner } from 'typeorm';

// Six columns filtered/sorted by a hot query path with no supporting index —
// found during a full-project performance audit. Cheap, safe additions; no
// existing query behavior changes, just what's index-backed:
//   - tickets.priority: every ticket-list/count request with a priority
//     filter active (findPage/getCounts), same as the already-indexed status.
//   - knowledge_articles.status/view_count/created_at: ArticlesRepository
//     .findPage filters on status and sorts on view_count ('popular') or
//     created_at ('recent') for every FAQ/admin article-list request — this
//     table was missed by the AddCreatedAtIndexes migration.
//   - csat_answers.created_at / settings_audit_log.event_type: filtered by
//     the CSAT and settings-audit reports respectively.
export class AddPerfIndexes1786196952000 implements MigrationInterface {
  name = 'AddPerfIndexes1786196952000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_tickets_priority" ON "tickets" ("priority")`);
    await queryRunner.query(`CREATE INDEX "IDX_knowledge_articles_status" ON "knowledge_articles" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_knowledge_articles_view_count" ON "knowledge_articles" ("view_count")`);
    await queryRunner.query(`CREATE INDEX "IDX_knowledge_articles_created_at" ON "knowledge_articles" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_csat_answers_created_at" ON "csat_answers" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_settings_audit_log_event_type" ON "settings_audit_log" ("event_type")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_settings_audit_log_event_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_csat_answers_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_knowledge_articles_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_knowledge_articles_view_count"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_knowledge_articles_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_priority"`);
  }
}
