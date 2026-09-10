import { MigrationInterface, QueryRunner } from "typeorm";

// Two fixes in one batch: (a) 'mention' was never migrated into this enum
// even though NotificationType.MENTION has been enqueued since the
// @-mentions feature shipped — the processor inserts the notifications row
// BEFORE sending the email (notifications.processor.ts), so every mention
// notification has been failing that insert (invalid enum value) and,
// consequently, never emailing either. (b) 'ticket_id' — the row previously
// had no way to say which ticket it was about, which blocked any UI list
// from ever being built on top of it (see notification.entity.ts).
export class AddNotificationTicketIdAndMention1784320000000 implements MigrationInterface {
    name = 'AddNotificationTicketIdAndMention1784320000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'mention'`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "ticket_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_ticket_id" ON "notifications" ("ticket_id")`);
        await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_ticket" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_ticket"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_ticket_id"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "ticket_id"`);
        // Postgres has no DROP VALUE for enums — same as every prior
        // migration in this lineage.
    }
}
