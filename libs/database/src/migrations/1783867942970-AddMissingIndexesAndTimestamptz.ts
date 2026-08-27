import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingIndexesAndTimestamptz1783867942970 implements MigrationInterface {
    name = 'AddMissingIndexesAndTimestamptz1783867942970'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ALTER COLUMN ... TYPE ... USING (not DROP+ADD) — a plain drop+add
        // of a NOT NULL/DEFAULT-now() column discards every existing row's
        // real value and replaces it with the single instant this migration
        // executes, since the new column has no way to inherit the old
        // data. This database happened to be empty every time this
        // migration has run so far, but the pattern is a landmine for any
        // future fresh-provision-then-migrate against a non-empty table
        // (e.g. a disaster-recovery restore of an older backup). Postgres
        // has no ambiguity converting a naive TIMESTAMP to TIMESTAMPTZ — it
        // treats the stored value as already being in the session's (UTC,
        // per this app's DB config) time zone, so no explicit `AT TIME
        // ZONE` conversion is needed for a same-instant reinterpretation.
        await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "deleted_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "deleted_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "sent_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "team_members" ALTER COLUMN "joined_at" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_8798a589dc4c71b6d0e8c2b9fc" ON "tickets" ("created_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_47c3fba35bfcbb08e3445f57d6" ON "tickets" ("assigned_to") `);
        await queryRunner.query(`CREATE INDEX "IDX_ec5071f9de4677c9e8da947e14" ON "tickets" ("team_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c360b09be17eb2e10280304f60" ON "tickets" ("sla_policy_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6d38899c31997c45d128a8973" ON "comments" ("author_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4099548d209f5ebbad2164ac56" ON "knowledge_articles" ("author_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2bf4967c8c2a6b845dadfbf3d" ON "team_members" ("user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c2bf4967c8c2a6b845dadfbf3d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4099548d209f5ebbad2164ac56"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6d38899c31997c45d128a8973"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c360b09be17eb2e10280304f60"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec5071f9de4677c9e8da947e14"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47c3fba35bfcbb08e3445f57d6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8798a589dc4c71b6d0e8c2b9fc"`);
        // Mirrors up() — reinterpret-in-place via ALTER COLUMN ... TYPE,
        // never drop+add, for the same data-preservation reason.
        await queryRunner.query(`ALTER TABLE "team_members" ALTER COLUMN "joined_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "sent_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ALTER COLUMN "updated_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "knowledge_articles" ALTER COLUMN "created_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "created_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "created_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "deleted_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "updated_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "created_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "deleted_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "updated_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "created_at" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN "created_at" TYPE TIMESTAMP`);
    }

}
