import { MigrationInterface, QueryRunner } from "typeorm";

// See AddReportGroupByDimensions — saved_reports.group_by is a Postgres enum
// column, so ReportGroupBy.COMPANY needs the same ALTER TYPE treatment.
export class AddReportGroupByCompany1784350000000 implements MigrationInterface {
    name = 'AddReportGroupByCompany1784350000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'company'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums — same rationale as every
        // prior migration in this file's lineage.
    }
}
