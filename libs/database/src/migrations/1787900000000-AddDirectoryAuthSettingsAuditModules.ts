import { MigrationInterface, QueryRunner } from 'typeorm';

// New SettingsAuditModule values for the LDAP/OIDC config CRUD modules — see
// AddMergedFromActivityType for why a Postgres ADD VALUE has to be its own
// migration, separate from anything that uses the new values.
export class AddDirectoryAuthSettingsAuditModules1787900000000 implements MigrationInterface {
  name = 'AddDirectoryAuthSettingsAuditModules1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."settings_audit_log_module_enum" ADD VALUE 'ldap_config'`);
    await queryRunner.query(`ALTER TYPE "public"."settings_audit_log_module_enum" ADD VALUE 'oidc_config'`);
  }

  public async down(): Promise<void> {
    // Postgres has no DROP VALUE for enums — no-op, same as every other
    // ADD VALUE migration in this codebase.
  }
}
