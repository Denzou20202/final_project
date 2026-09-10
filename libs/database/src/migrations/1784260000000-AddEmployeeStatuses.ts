import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeStatuses1784260000000 implements MigrationInterface {
    name = 'AddEmployeeStatuses1784260000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "employee_statuses" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "color" character varying(7) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_employee_statuses_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "employee_status_history" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "status_name" text NOT NULL,
                "status_color" character varying(7),
                "automatic" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_employee_status_history_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_employee_status_history_user_id" ON "employee_status_history" ("user_id")`);
        await queryRunner.query(`
            ALTER TABLE "employee_status_history"
            ADD CONSTRAINT "FK_employee_status_history_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE "presence_settings" (
                "id" smallint NOT NULL,
                "inactivity_timeout_minutes" integer NOT NULL DEFAULT 15,
                CONSTRAINT "PK_presence_settings_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`ALTER TABLE "users" ADD "current_status_id" uuid`);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_current_status" FOREIGN KEY ("current_status_id") REFERENCES "employee_statuses"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_current_status"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "current_status_id"`);

        await queryRunner.query(`DROP TABLE "presence_settings"`);

        await queryRunner.query(`ALTER TABLE "employee_status_history" DROP CONSTRAINT "FK_employee_status_history_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_employee_status_history_user_id"`);
        await queryRunner.query(`DROP TABLE "employee_status_history"`);

        await queryRunner.query(`DROP TABLE "employee_statuses"`);
    }

}
