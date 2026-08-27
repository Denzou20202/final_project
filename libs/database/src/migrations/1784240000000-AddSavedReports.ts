import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSavedReports1784240000000 implements MigrationInterface {
    name = 'AddSavedReports1784240000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."saved_reports_group_by_enum" AS ENUM('assignee', 'client', 'team')`);
        await queryRunner.query(`
            CREATE TABLE "saved_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "group_by" "public"."saved_reports_group_by_enum" NOT NULL,
                "filters" jsonb NOT NULL,
                "columns" jsonb,
                "created_by" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_saved_reports_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_saved_reports_created_by" ON "saved_reports" ("created_by")`);
        await queryRunner.query(`
            ALTER TABLE "saved_reports"
            ADD CONSTRAINT "FK_saved_reports_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "saved_reports" DROP CONSTRAINT "FK_saved_reports_created_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_saved_reports_created_by"`);
        await queryRunner.query(`DROP TABLE "saved_reports"`);
        await queryRunner.query(`DROP TYPE "public"."saved_reports_group_by_enum"`);
    }

}
