import { AuthAudience, UserRole } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-configurable OIDC settings for federated SSO (Entra ID/Azure AD,
// Okta, Google Workspace, any generic OIDC IdP) — one row per audience
// (staff/client), same non-multi-tenant shape as LdapConfigEntity. The
// authorization-code + PKCE flow is handled by oidc-auth.controller.ts;
// CRUD + test lives in OidcConfigModule.
@Entity('oidc_configs')
export class OidcConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'enum', enum: AuthAudience })
  audience!: AuthAudience;

  // Kept false until an admin flips it — OidcConfigService rejects the
  // transition to true unless lastTestSuccessAt is fresh, mirroring
  // LdapConfigEntity.enabled's rollout-safety guard.
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  // e.g. "https://login.microsoftonline.com/{tenantId}/v2.0" for Entra ID.
  @Column({ name: 'issuer_url', type: 'varchar', length: 500 })
  issuerUrl!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 255 })
  clientId!: string;

  // AES-256-GCM ciphertext (DirectorySecretEncryptionService), never the raw
  // secret. Nullable only so a row can be created before the secret is set
  // on the very first save.
  @Column({ name: 'client_secret_encrypted', type: 'varchar', length: 512, nullable: true })
  clientSecretEncrypted?: string | null;

  // Must be registered on the IdP side — surfaced read-only in the admin
  // form so there's one obvious value to copy into the app registration.
  @Column({ name: 'redirect_uri', type: 'varchar', length: 500 })
  redirectUri!: string;

  @Column({ type: 'varchar', length: 255, default: 'openid profile email' })
  scopes!: string;

  // Entra ID sometimes only reliably populates preferred_username rather
  // than email — configurable rather than hardcoded to the OIDC spec's
  // nominal "email" claim.
  @Column({ name: 'email_claim', type: 'varchar', length: 100, default: 'email' })
  emailClaim!: string;

  @Column({ name: 'full_name_claim', type: 'varchar', length: 100, default: 'name' })
  fullNameClaim!: string;

  // Role assigned to a brand-new account on first SSO login (see
  // UsersService.provisionFromDirectory) — DTO-validated to CLIENT for
  // audience=client, {OPERATOR, ADMIN} for audience=staff.
  @Column({ name: 'default_role', type: 'enum', enum: UserRole })
  defaultRole!: UserRole;

  @Column({ name: 'last_test_success_at', type: 'timestamptz', nullable: true })
  lastTestSuccessAt?: Date | null;

  @Column({ name: 'last_test_error', type: 'text', nullable: true })
  lastTestError?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
