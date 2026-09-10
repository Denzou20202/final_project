import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionGroups1784250000000 implements MigrationInterface {
    name = 'AddPermissionGroups1784250000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "permission_groups" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "restrict_to_departments" boolean NOT NULL DEFAULT false,
                "restrict_to_own_tickets" boolean NOT NULL DEFAULT false,
                "cannot_be_assignee" boolean NOT NULL DEFAULT false,
                "require_two_factor" boolean NOT NULL DEFAULT false,
                "ip_whitelist" text[] NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_permission_groups_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "permission_group_departments" (
                "permission_group_id" uuid NOT NULL,
                "team_id" uuid NOT NULL,
                CONSTRAINT "PK_permission_group_departments" PRIMARY KEY ("permission_group_id", "team_id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_permission_group_departments_team_id" ON "permission_group_departments" ("team_id")`);
        await queryRunner.query(`
            ALTER TABLE "permission_group_departments"
            ADD CONSTRAINT "FK_permission_group_departments_group" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "permission_group_departments"
            ADD CONSTRAINT "FK_permission_group_departments_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE "user_extra_departments" (
                "user_id" uuid NOT NULL,
                "team_id" uuid NOT NULL,
                CONSTRAINT "PK_user_extra_departments" PRIMARY KEY ("user_id", "team_id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_user_extra_departments_team_id" ON "user_extra_departments" ("team_id")`);
        await queryRunner.query(`
            ALTER TABLE "user_extra_departments"
            ADD CONSTRAINT "FK_user_extra_departments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_extra_departments"
            ADD CONSTRAINT "FK_user_extra_departments_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`ALTER TABLE "users" ADD "permission_group_id" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_secret_encrypted" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "two_factor_enabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_permission_group" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_permission_group"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "two_factor_enabled"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_secret_encrypted"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "permission_group_id"`);

        await queryRunner.query(`ALTER TABLE "user_extra_departments" DROP CONSTRAINT "FK_user_extra_departments_team"`);
        await queryRunner.query(`ALTER TABLE "user_extra_departments" DROP CONSTRAINT "FK_user_extra_departments_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_extra_departments_team_id"`);
        await queryRunner.query(`DROP TABLE "user_extra_departments"`);

        await queryRunner.query(`ALTER TABLE "permission_group_departments" DROP CONSTRAINT "FK_permission_group_departments_team"`);
        await queryRunner.query(`ALTER TABLE "permission_group_departments" DROP CONSTRAINT "FK_permission_group_departments_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_permission_group_departments_team_id"`);
        await queryRunner.query(`DROP TABLE "permission_group_departments"`);

        await queryRunner.query(`DROP TABLE "permission_groups"`);
    }

}
