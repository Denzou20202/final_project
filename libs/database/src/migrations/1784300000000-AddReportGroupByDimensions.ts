import { MigrationInterface, QueryRunner } from "typeorm";

// The report constructor's groupBy grows from 3 dimensions (assignee/
// client/team) to 9 — see ReportGroupBy in libs/types. saved_reports.
// group_by is a Postgres enum column, so every new value needs a matching
// ALTER TYPE here, same as ticket_activities_type_enum's migrations.
export class AddReportGroupByDimensions1784300000000 implements MigrationInterface {
    name = 'AddReportGroupByDimensions1784300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'status'`);
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'priority'`);
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'type'`);
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'tag'`);
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'sla_policy'`);
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'period'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums — same rationale as every
        // prior migration in this file's lineage.
    }
}
