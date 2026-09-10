import { MigrationInterface, QueryRunner } from "typeorm";

// Postgres enum types don't auto-sync with the TypeScript enums that
// describe them — every new TicketActivityType/NotificationType value added
// in libs/types needs a matching `ALTER TYPE ... ADD VALUE` here, or the
// first INSERT using it throws `invalid input value for enum`. This
// migration catches up two enums at once (both went stale in the same
// batch of work): ticket_activities_type_enum (tags/merge/trash activity
// logging) and notifications_type_enum (the new "send status" email type).
export class AddTicketLifecycleActivityTypes1784050000000 implements MigrationInterface {
    name = 'AddTicketLifecycleActivityTypes1784050000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'tag_added'`);
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'tag_removed'`);
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'merged_into'`);
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'deleted'`);
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'restored'`);
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'status_email_sent'`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'status_update'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums; rebuilding the type is only
        // needed if a downgrade must reject the value outright, which isn't
        // required here — down() is a no-op for this migration (same
        // rationale as AddSlaBreachActivityTypes).
    }

}
