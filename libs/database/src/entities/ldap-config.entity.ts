import { AuthAudience, UserRole } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-configurable LDAP bind settings for directory authentication — one
// row per audience (staff/client), never per-Company (VeloxDesk deployments
// are single-tenant; see AuthAudience). Login credential-checking reads this
// via LdapAuthProvider (apps/user-service/src/auth/providers); CRUD +
// test-connection lives in LdapConfigModule.
@Entity('ldap_configs')
export class LdapConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'enum', enum: AuthAudience })
  audience!: AuthAudience;

  // Kept false until an admin flips it — LdapConfigService rejects the
  // transition to true unless lastTestSuccessAt is fresh (see that
  // service), so a half-configured row can never lock out real logins.
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  // e.g. "ldaps://dc01.corp.local:636"
  @Column({ type: 'varchar', length: 255 })
  url!: string;

  // Service account used to search for the submitted username — LDAP login
  // names (sAMAccountName/UPN/mail) usually aren't the bind DN, so this is a
  // search-then-bind flow, not a direct bind as the end user.
  @Column({ name: 'bind_dn', type: 'varchar', length: 255 })
  bindDn!: string;

  // AES-256-GCM ciphertext (DirectorySecretEncryptionService), never the raw
  // password. Nullable only so a row can be created before the secret is
  // set on the very first save.
  @Column({ name: 'bind_password_encrypted', type: 'varchar', length: 512, nullable: true })
  bindPasswordEncrypted?: string | null;

  // e.g. "OU=Staff,DC=corp,DC=local"
  @Column({ name: 'search_base', type: 'varchar', length: 255 })
  searchBase!: string;

  // {{username}} is substituted with the submitted login. Admin-editable so
  // both AD (sAMAccountName/userPrincipalName) and generic LDAP (uid)
  // schemas work without a code change.
  @Column({
    name: 'user_filter_template',
    type: 'varchar',
    length: 512,
    default: '(&(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})(mail={{username}})))',
  })
  userFilterTemplate!: string;

  @Column({ name: 'email_attribute', type: 'varchar', length: 100, default: 'mail' })
  emailAttribute!: string;

  @Column({ name: 'full_name_attribute', type: 'varchar', length: 100, default: 'displayName' })
  fullNameAttribute!: string;

  // AD: objectGUID. Generic LDAP: entryUUID. Deliberately not the DN, which
  // changes on an OU move — see UserEntity.externalId.
  @Column({ name: 'external_id_attribute', type: 'varchar', length: 100, default: 'objectGUID' })
  externalIdAttribute!: string;

  // Escape hatch for self-signed certs during rollout against an internal
  // CA — security-sensitive, every change is written to settings_audit_log.
  @Column({ name: 'tls_reject_unauthorized', type: 'boolean', default: true })
  tlsRejectUnauthorized!: boolean;

  // Role assigned to a brand-new account on first directory login (see
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
