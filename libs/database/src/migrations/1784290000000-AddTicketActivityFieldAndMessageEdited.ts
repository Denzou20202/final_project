import { MigrationInterface, QueryRunner } from "typeorm";

// Two additions in one batch: (a) 'message_edited' — chat-service now logs
// an audit entry when someone edits their own chat message, alongside the
// existing ticket-service-owned edit types; (b) the 'field' column lets a
// generic 'edited' entry say WHICH ticket attribute changed (title/
// description/type/team) instead of encoding it as an ad-hoc string prefix
// inside from_value/to_value, which is what tickets.service.ts did before
// this migration for 'type'/'team' changes.
export class AddTicketActivityFieldAndMessageEdited1784290000000 implements MigrationInterface {
    name = 'AddTicketActivityFieldAndMessageEdited1784290000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'message_edited'`);
        await queryRunner.query(`ALTER TABLE "ticket_activities" ADD "field" character varying(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_activities" DROP COLUMN "field"`);
        // Postgres has no DROP VALUE for enums — same rationale as every
        // prior migration in this file's lineage (e.g.
        // AddTicketLifecycleActivityTypes): down() can't un-add the value.
    }
}
