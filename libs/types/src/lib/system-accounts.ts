// Fixed row seeded by the AddSystemUser migration (libs/database/src/migrations)
// — used as `comments.author_id` for automation-rule replies fired on a
// ticket that has no human assignee yet (comments.author_id is NOT NULL, so
// "post as nobody" isn't an option). Permanently deactivated (deleted_at
// set) so it's excluded everywhere staff-deactivation is already filtered
// (assignee pickers, mentions, teams) without any new special-casing —
// see TicketsService.applyAutomatedReply and the migration's own comment
// for the full rationale. The literal value here MUST match the one
// hardcoded in that migration's INSERT — there's no single source of truth
// across the raw-SQL migration and this TS constant, so keep them in sync
// by hand if either ever changes.
export const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
