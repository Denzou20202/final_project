import { MigrationInterface, QueryRunner } from "typeorm";

// data-id="UUID" regexes duplicated from libs/common/src/comment-body/
// extract-mentioned-user-ids.ts — migrations in this codebase never import
// from app/lib packages, so this is a deliberate one-time copy, not a
// shared import. Keep in sync by hand if that extraction regex ever changes.
const MENTION_SPAN_RE = /<span\b[^>]*>/gi;
const IS_MENTION_RE = /data-type="mention"/i;
const DATA_ID_RE = /data-id="([0-9a-f-]{36})"/i;

function extractMentionedUserIds(html: string): string[] {
    const ids = new Set<string>();
    for (const match of html.matchAll(MENTION_SPAN_RE)) {
        const tag = match[0];
        if (!IS_MENTION_RE.test(tag)) continue;
        const idMatch = DATA_ID_RE.exec(tag);
        if (idMatch) ids.add(idMatch[1]);
    }
    return [...ids];
}

// New table backing the "@mention grants access" feature — see
// TicketMentionEntity's own comment for the full rationale. This migration
// also backfills mentions that happened before the feature shipped, by
// re-parsing every staff-authored comment's body, so already-mentioned
// operators get retroactive access instead of only future mentions counting.
// Mirrors ChatService.postMessage's own rule exactly: client-authored
// comments never produce mentions, and a self-mention is dropped.
export class AddTicketMentions1787400000000 implements MigrationInterface {
    name = 'AddTicketMentions1787400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ticket_mentions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "mentioned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_mentions_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_mentions_ticket_user" ON "ticket_mentions" ("ticket_id", "user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_mentions_user_id" ON "ticket_mentions" ("user_id")`);
        await queryRunner.query(`
            ALTER TABLE "ticket_mentions"
            ADD CONSTRAINT "FK_ticket_mentions_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "ticket_mentions"
            ADD CONSTRAINT "FK_ticket_mentions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        const rows: { ticket_id: string; author_id: string; body: string }[] = await queryRunner.query(`
            SELECT c."ticket_id", c."author_id", c."body"
            FROM "comments" c
            INNER JOIN "users" u ON u."id" = c."author_id"
            WHERE u."role" != 'client'
        `);

        const pairs = new Map<string, { ticketId: string; userId: string }>();
        for (const row of rows) {
            for (const mentionedId of extractMentionedUserIds(row.body)) {
                if (mentionedId === row.author_id) continue;
                pairs.set(`${row.ticket_id}:${mentionedId}`, { ticketId: row.ticket_id, userId: mentionedId });
            }
        }

        // Chunked bulk insert, not one INSERT per row — comments can run into
        // the tens of thousands on a real dataset. 500 rows/batch keeps each
        // statement's parameter count (2 params/row) well under Postgres'
        // ~65535 bind-parameter ceiling.
        const values = [...pairs.values()];
        const CHUNK = 500;
        for (let i = 0; i < values.length; i += CHUNK) {
            const chunk = values.slice(i, i + CHUNK);
            const placeholders = chunk.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(', ');
            const params = chunk.flatMap((p) => [p.ticketId, p.userId]);
            await queryRunner.query(
                `INSERT INTO "ticket_mentions" ("ticket_id", "user_id") VALUES ${placeholders} ON CONFLICT DO NOTHING`,
                params,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_mentions" DROP CONSTRAINT "FK_ticket_mentions_user"`);
        await queryRunner.query(`ALTER TABLE "ticket_mentions" DROP CONSTRAINT "FK_ticket_mentions_ticket"`);
        await queryRunner.query(`DROP TABLE "ticket_mentions"`);
    }

}
