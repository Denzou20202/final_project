import { MigrationInterface, QueryRunner } from "typeorm";

// «Подразделение» was always free text holding the client's actual
// company/legal-entity name in practice — renamed so the report builder can
// group/filter tickets by company (`ReportGroupBy.COMPANY`) without a full
// relational Company entity (that remains a separate, larger Sprint-20 task).
export class RenameUserSubdivisionToCompany1784330000000 implements MigrationInterface {
    name = 'RenameUserSubdivisionToCompany1784330000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "subdivision" TO "company"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "company" TO "subdivision"`);
    }
}
