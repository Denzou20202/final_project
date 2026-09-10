import { MigrationInterface, QueryRunner } from "typeorm";

// See AddReportGroupByDimensions — saved_reports.group_by is a Postgres enum
// column, so ReportGroupBy.CHANNEL needs the same ALTER TYPE treatment.
export class AddReportGroupByChannel1786900000000 implements MigrationInterface {
    name = 'AddReportGroupByChannel1786900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'channel'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums — same rationale as every
        // prior migration in this file's lineage.
    }
}
