import { MigrationInterface, QueryRunner } from "typeorm";

// MESSAGE_EDITED activity rows store the edited comment's full before/after
// text (see ChatService.editMessage) with no record of whether that comment
// was an internal staff note — TicketsService.getActivity had no way to
// keep an internal note's edit history out of a client's view the way
// ChatService.getHistory already keeps the note itself out of it. This
// backfills every existing MESSAGE_EDITED row against comments.is_internal
// (best-effort: a comment later hard-deleted by Trash leaves its activity
// row's flag at the safe default, false) and adds the column new rows are
// written with going forward.
export class AddTicketActivityInternalFlag1788200000000 implements MigrationInterface {
    name = 'AddTicketActivityInternalFlag1788200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_activities" ADD "internal" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`
            UPDATE "ticket_activities" a
            SET "internal" = true
            FROM "comments" c
            WHERE a."type" = 'message_edited'
              AND c."is_internal" = true
              AND c."ticket_id" = a."ticket_id"
              AND c."body" = a."to_value"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_activities" DROP COLUMN "internal"`);
    }

}
