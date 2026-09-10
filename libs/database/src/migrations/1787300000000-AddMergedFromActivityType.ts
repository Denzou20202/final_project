import { MigrationInterface, QueryRunner } from "typeorm";

// merge() used to log MERGED_INTO on both the source AND target ticket
// (distinguished only by which of fromValue/toValue was set), leaving the
// activity type itself unable to tell direction apart. This adds a distinct
// value for the target side — see AddTicketLifecycleActivityTypes for why
// this has to be its own migration (Postgres enum values can't be added and
// used in the same transaction/migration as pre-existing rows).
export class AddMergedFromActivityType1787300000000 implements MigrationInterface {
    name = 'AddMergedFromActivityType1787300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'merged_from'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums — no-op, same as every other
        // ADD VALUE migration in this codebase.
    }

}
