import { MigrationInterface, QueryRunner } from "typeorm";

// users.permission_group_id (added by AddPermissionGroups) never got an
// index — Postgres doesn't auto-index a referencing FK column, only the
// referenced side. Filtered/counted on every permission-group list load
// (PermissionGroupsRepository.countMembers/countMembersByGroupIds) and
// scanned on every permission-group delete (ON DELETE SET NULL nulls out
// members). Negligible at current scale (~1500 users), but a genuine,
// easy-to-fix gap.
export class AddPermissionGroupIdIndex1787600000000 implements MigrationInterface {
    name = 'AddPermissionGroupIdIndex1787600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_users_permission_group_id" ON "users" ("permission_group_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_users_permission_group_id"`);
    }

}
