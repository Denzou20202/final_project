import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSlaBreachActivityTypes1783880000000 implements MigrationInterface {
    name = 'AddSlaBreachActivityTypes1783880000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'sla_response_breached'`);
        await queryRunner.query(`ALTER TYPE "public"."ticket_activities_type_enum" ADD VALUE 'sla_resolution_breached'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums; rebuilding the type is only
        // needed if a downgrade must reject the value outright, which isn't
        // required here — down() is a no-op for this migration.
    }

}
