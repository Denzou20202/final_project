import { MigrationInterface, QueryRunner } from "typeorm";

// Seeds one fixed-UUID row used as `comments.author_id` for automation-rule
// replies fired on a ticket that has no human assignee yet — comments.author_id
// is NOT NULL and there's no separate "system"/"bot" role, so a real row is
// the only option. See TicketsService.applyAutomatedReply and
// libs/types/src/lib/system-accounts.ts (SYSTEM_USER_ID — MUST match the id
// literal below, there's no shared source of truth between this raw-SQL
// migration and that TS constant).
//
// deleted_at is set immediately so this account is permanently "deactivated"
// — it reuses every existing deactivated-user filter (assignee pickers,
// mentions autocomplete, team membership) for free, and login is blocked the
// same way a real deactivated account's login is. It is deliberately never
// assigned to a ticket (assign()/applyAutomatedAssignee() both do a plain
// findOne with no `withDeleted`, so a deactivated user can't become an
// assignee anyway) — applyAutomatedReply only ever uses this id as a comment
// author on an otherwise-unassigned ticket, never touches ticket.assigned_to.
// approved_at is set so it never appears in the pending-registrations queue.
// password_hash is a real bcrypt hash of a random, never-recorded string —
// not a placeholder string, because AuthService.login() runs bcrypt.compare
// BEFORE checking deleted_at, and compare() throws on a malformed hash
// instead of just returning false. A real hash of an unknown password makes
// any login attempt fail cleanly at that first check (nobody can ever know
// the plaintext), same end result as the deleted_at gate would give anyway.
export class AddSystemUser1786176155000 implements MigrationInterface {
    name = 'AddSystemUser1786176155000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "users" ("id", "email", "password_hash", "full_name", "role", "approved_at", "deleted_at")
            VALUES (
                '00000000-0000-4000-8000-000000000001',
                'system@veloxdesk.local',
                '$2b$10$o3OmjDELOzVHRodxUv6sk.NXLwr8OAnnxBMl3nC2xcZWPms.4mZH.',
                'Автоответчик',
                'operator',
                now(),
                now()
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "users" WHERE "id" = '00000000-0000-4000-8000-000000000001'`);
    }
}
