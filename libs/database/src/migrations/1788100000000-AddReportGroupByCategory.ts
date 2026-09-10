import { MigrationInterface, QueryRunner } from "typeorm";

// See AddReportGroupByCompany — ReportGroupBy.CATEGORY was added to the TS
// enum (libs/types) alongside AddTicketCategories (1786300000000), but the
// matching ALTER TYPE for saved_reports.group_by was never added, so saving
// a report grouped by category (ad-hoc "run" works fine, only the SAVE path
// touches this column) throws `invalid input value for enum
// saved_reports_group_by_enum: "category"`.
export class AddReportGroupByCategory1788100000000 implements MigrationInterface {
    name = 'AddReportGroupByCategory1788100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."saved_reports_group_by_enum" ADD VALUE 'category'`);
    }

    public async down(): Promise<void> {
        // Postgres has no DROP VALUE for enums — same rationale as every
        // prior migration in this file's lineage.
    }
}
