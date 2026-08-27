import { MigrationInterface, QueryRunner } from 'typeorm';

// Admin-configurable directory-auth settings — see LdapConfigEntity/
// OidcConfigEntity. At most one row per audience (staff/client) per table,
// enforced by the unique index on "audience" — not a multi-tenant table.
export class AddLdapAndOidcConfigs1787800000000 implements MigrationInterface {
  name = 'AddLdapAndOidcConfigs1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."ldap_configs_audience_enum" AS ENUM('staff', 'client')`);
    await queryRunner.query(`CREATE TYPE "public"."ldap_configs_default_role_enum" AS ENUM('client', 'operator', 'admin')`);
    await queryRunner.query(
      `CREATE TABLE "ldap_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "audience" "public"."ldap_configs_audience_enum" NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "url" character varying(255) NOT NULL,
        "bind_dn" character varying(255) NOT NULL,
        "bind_password_encrypted" character varying(512),
        "search_base" character varying(255) NOT NULL,
        "user_filter_template" character varying(512) NOT NULL DEFAULT '(&(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})(mail={{username}})))',
        "email_attribute" character varying(100) NOT NULL DEFAULT 'mail',
        "full_name_attribute" character varying(100) NOT NULL DEFAULT 'displayName',
        "external_id_attribute" character varying(100) NOT NULL DEFAULT 'objectGUID',
        "tls_reject_unauthorized" boolean NOT NULL DEFAULT true,
        "default_role" "public"."ldap_configs_default_role_enum" NOT NULL,
        "last_test_success_at" TIMESTAMP WITH TIME ZONE,
        "last_test_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ldap_configs_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ldap_configs_audience" ON "ldap_configs" ("audience")`);

    await queryRunner.query(`CREATE TYPE "public"."oidc_configs_audience_enum" AS ENUM('staff', 'client')`);
    await queryRunner.query(`CREATE TYPE "public"."oidc_configs_default_role_enum" AS ENUM('client', 'operator', 'admin')`);
    await queryRunner.query(
      `CREATE TABLE "oidc_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "audience" "public"."oidc_configs_audience_enum" NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "issuer_url" character varying(500) NOT NULL,
        "client_id" character varying(255) NOT NULL,
        "client_secret_encrypted" character varying(512),
        "redirect_uri" character varying(500) NOT NULL,
        "scopes" character varying(255) NOT NULL DEFAULT 'openid profile email',
        "email_claim" character varying(100) NOT NULL DEFAULT 'email',
        "full_name_claim" character varying(100) NOT NULL DEFAULT 'name',
        "default_role" "public"."oidc_configs_default_role_enum" NOT NULL,
        "last_test_success_at" TIMESTAMP WITH TIME ZONE,
        "last_test_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oidc_configs_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_oidc_configs_audience" ON "oidc_configs" ("audience")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_oidc_configs_audience"`);
    await queryRunner.query(`DROP TABLE "oidc_configs"`);
    await queryRunner.query(`DROP TYPE "public"."oidc_configs_default_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."oidc_configs_audience_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_ldap_configs_audience"`);
    await queryRunner.query(`DROP TABLE "ldap_configs"`);
    await queryRunner.query(`DROP TYPE "public"."ldap_configs_default_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."ldap_configs_audience_enum"`);
  }
}
