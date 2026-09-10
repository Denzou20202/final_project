import { MigrationInterface, QueryRunner } from "typeorm";

// Replaces the fixed 4-value "tickets"."status" enum with a lookup table
// (ticket_statuses) so admins can create/edit/delete their own ticket
// statuses (see TicketStatusEntity, apps/ticket-service's ticket-statuses
// module). Follows the same "parallel structure -> backfill -> swap -> drop
// old" shape DropNewTicketStatus1784420000000 used for a single-value
// removal, scaled up to a full enum -> table conversion. The 4 fixed ids
// below MUST match libs/types/src/lib/seeded-ticket-status-ids.ts's
// SEEDED_TICKET_STATUS_IDS by hand — same caveat as SYSTEM_USER_ID, no
// single source of truth across raw-SQL migrations and TS.
const OPEN_ID = '00000000-0000-4000-8000-000000000101';
const PENDING_ID = '00000000-0000-4000-8000-000000000102';
const RESOLVED_ID = '00000000-0000-4000-8000-000000000103';
const CLOSED_ID = '00000000-0000-4000-8000-000000000104';

export class AddTicketStatuses1787200000000 implements MigrationInterface {
    name = 'AddTicketStatuses1787200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ticket_statuses" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" character varying(20),
                "name" character varying(255) NOT NULL,
                "color" character varying(7) NOT NULL,
                "is_default" boolean NOT NULL DEFAULT false,
                "is_closed" boolean NOT NULL DEFAULT false,
                "tracks_sla" boolean NOT NULL DEFAULT true,
                "sort_order" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_statuses_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_statuses_key" ON "ticket_statuses" ("key")`);
        // Belt-and-suspenders for the app-level isDefault-exclusivity check
        // (TicketStatusesService) — a partial unique index permits any number
        // of is_default=false rows but at most one is_default=true row.
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_ticket_statuses_single_default" ON "ticket_statuses" ("is_default") WHERE "is_default" = true`,
        );

        await queryRunner.query(`
            INSERT INTO "ticket_statuses" ("id", "key", "name", "color", "is_default", "is_closed", "tracks_sla", "sort_order") VALUES
                ('${OPEN_ID}', 'open', 'В работе', '#C2683F', true, false, true, 1),
                ('${PENDING_ID}', 'pending', 'Ожидание', '#E6A817', false, false, true, 2),
                ('${RESOLVED_ID}', 'resolved', 'Передано разработчикам', '#5B8A72', false, false, false, 3),
                ('${CLOSED_ID}', 'closed', 'Завершено', '#C7BDAF', false, true, false, 4)
        `);

        await queryRunner.query(`ALTER TABLE "tickets" ADD "status_id" uuid`);
        await queryRunner.query(`
            UPDATE "tickets" SET "status_id" = (CASE "status"
                WHEN 'open' THEN '${OPEN_ID}'
                WHEN 'pending' THEN '${PENDING_ID}'
                WHEN 'resolved' THEN '${RESOLVED_ID}'
                WHEN 'closed' THEN '${CLOSED_ID}'
            END)::uuid
        `);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status_id" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_status_id" ON "tickets" ("status_id")`);
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD CONSTRAINT "FK_tickets_status" FOREIGN KEY ("status_id") REFERENCES "ticket_statuses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);

        // Drops the old enum column (and, as a side effect, its own index —
        // Postgres cascades index drops for columns dropped this way) and the
        // now-unused enum type itself.
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);

        // --- automation_rules: remap stored 'open'/'pending'/'resolved'/
        // 'closed' string literals (STATUS conditions, SET_STATUS actions) to
        // the seeded status ids above. The 'unassigned' sentinel value (see
        // AutomationCondition's doc comment) is left untouched — it isn't a
        // real status.
        const idByLegacyValue: Record<string, string> = {
            open: OPEN_ID,
            pending: PENDING_ID,
            resolved: RESOLVED_ID,
            closed: CLOSED_ID,
        };
        const rules: { id: string; conditions: unknown; actions: unknown }[] = await queryRunner.query(
            `SELECT "id", "conditions", "actions" FROM "automation_rules"`,
        );
        for (const rule of rules) {
            let changed = false;
            const conditions = (Array.isArray(rule.conditions) ? rule.conditions : []).map((c: Record<string, unknown>) => {
                if (c?.field === 'status' && idByLegacyValue[c.value as string]) {
                    changed = true;
                    return { ...c, value: idByLegacyValue[c.value as string] };
                }
                return c;
            });
            const actions = (Array.isArray(rule.actions) ? rule.actions : []).map((a: Record<string, unknown>) => {
                if (a?.type === 'set_status' && idByLegacyValue[a.value as string]) {
                    changed = true;
                    return { ...a, value: idByLegacyValue[a.value as string] };
                }
                return a;
            });
            if (changed) {
                await queryRunner.query(
                    `UPDATE "automation_rules" SET "conditions" = $1, "actions" = $2 WHERE "id" = $3`,
                    [JSON.stringify(conditions), JSON.stringify(actions), rule.id],
                );
            }
        }
    }

    // Restores the enum column so the schema matches the old shape again.
    // Cannot restore per-ticket accuracy for anything that was ever moved to
    // a custom (non-seeded) status — those fold to 'open', same "information
    // is gone" caveat DropNewTicketStatus's down() documents. Does not
    // reverse the automation_rules remap above (same reasoning).
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tickets_status_enum" AS ENUM('open', 'pending', 'resolved', 'closed')`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "status" "public"."tickets_status_enum"`);
        await queryRunner.query(`
            UPDATE "tickets" t SET "status" = COALESCE(ts."key", 'open')::"public"."tickets_status_enum"
            FROM "ticket_statuses" ts WHERE ts."id" = t."status_id"
        `);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'open'`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_status" ON "tickets" ("status")`);

        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_status_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "status_id"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_ticket_statuses_single_default"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ticket_statuses_key"`);
        await queryRunner.query(`DROP TABLE "ticket_statuses"`);
    }

}
