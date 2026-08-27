import { AuthProvider, Locale, UserRole } from '@veloxdesk/types';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
// Prevents duplicate JIT-provisioned accounts on repeat directory logins —
// see UsersService.provisionFromDirectory's lookup-by-(authProvider,
// externalId) fast path. Partial: only rows with a directory identity are
// indexed, so this stays tiny and never conflicts with the many rows where
// externalId is null (authProvider = LOCAL).
@Index('IDX_users_auth_provider_external_id', ['authProvider', 'externalId'], {
  unique: true,
  where: '"external_id" IS NOT NULL',
})
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  // Null for directory-provisioned/linked accounts (authProvider !== LOCAL)
  // — see UsersService.provisionFromDirectory. Never checked for those
  // accounts; AuthService.login() branches on authProvider before ever
  // touching this column.
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  // How this account authenticates. 'local' (default) means passwordHash is
  // the source of truth; 'ldap'/'oidc' means the account is bound to a
  // directory identity (see externalId below) and passwordHash is null.
  @Column({ name: 'auth_provider', type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider!: AuthProvider;

  // The directory's stable subject id for this account: AD objectGUID
  // (or generic LDAP entryUUID) for LDAP, the OIDC `sub` claim for OIDC.
  // Deliberately not the LDAP DN, which can change on an OU move. Null for
  // authProvider = LOCAL. Uniqueness is scoped per-provider (see the
  // composite index below) since an LDAP GUID and an OIDC `sub` are opaque
  // strings from unrelated namespaces and could otherwise collide by
  // coincidence.
  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId?: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role!: UserRole;

  // Meaningful only when role = ADMIN — a "restricted admin" (e.g. a demo/
  // curator account) sees and manages everything a normal admin can EXCEPT
  // other ADMIN accounts: can't create one, can't touch an existing one's
  // role/password/status/profile/group/team. One-directional — a normal
  // admin can still fully manage a restricted admin's account (needed so it
  // can be cleaned up/deleted afterward). See UsersService
  // .assertAdminActionAllowed.
  @Column({ name: 'cannot_manage_admins', type: 'boolean', default: false })
  cannotManageAdmins!: boolean;

  // Meaningful only when role = CLIENT — admin-toggled (EditUserModal),
  // surfaced as a red sheriff-star badge next to the client's name wherever
  // operators see it (ticket list/detail, create-ticket client picker,
  // Users admin list). See UsersService.setVip.
  @Column({ name: 'is_vip', type: 'boolean', default: false })
  isVip!: boolean;

  // Organizational context about the person — entered by an admin via the
  // Users page, surfaced read-only in a ticket's «Клиент» panel. Unrelated
  // to the `teams` entity (that's a support queue for routing tickets;
  // this is the client's own company org chart).
  @Column({ name: 'computer_name', type: 'varchar', length: 255, nullable: true })
  computerName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  position?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department?: string | null;

  // Was `subdivision` (renamed 2026-07-27) — free text, but in practice
  // always held the client's actual company/legal-entity name (e.g. `ПрАТ
  // "CAB 92"`), so it doubles as the report builder's company dimension
  // (`ReportGroupBy.COMPANY`) without a full relational Company entity.
  @Column({ type: 'varchar', length: 255, nullable: true })
  company?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  // Set when this user was auto-created (or matched) by telegram-ingestion
  // — the Telegram chat.id to send outbound replies to. text, not bigint:
  // Postgres bigint comes back from TypeORM as a string anyway (dodging
  // Number precision loss), and this value is only ever compared for
  // equality, never used arithmetically. Unique when present — Postgres
  // allows multiple NULLs under a unique index, same as externalThreadId.
  @Index({ unique: true })
  @Column({ name: 'telegram_chat_id', type: 'text', nullable: true })
  telegramChatId?: string | null;

  // One-time token for the client-portal "Подключить Telegram" flow (see
  // UsersService.createTelegramLinkToken / TelegramUserResolverService
  // .linkByToken) — proves the Telegram chat belongs to whoever is already
  // logged into this account, rather than letting the bot auto-create a
  // new client for anyone who messages it. Null once consumed or once
  // superseded by a freshly generated token.
  @Index({ unique: true })
  @Column({ name: 'telegram_link_token', type: 'text', nullable: true })
  telegramLinkToken?: string | null;

  // Set alongside telegramLinkToken — a token past this instant is treated
  // as if it didn't exist, but isn't proactively cleaned up; it just sits
  // there until overwritten by the next generated link.
  @Column({ name: 'telegram_link_token_expires_at', type: 'timestamptz', nullable: true })
  telegramLinkTokenExpiresAt?: Date | null;

  // Set when the client taps "Создать тикет" in the Telegram bot's menu —
  // makes the very NEXT message on this chat force-create a brand-new
  // ticket instead of appending to any existing open Telegram ticket (see
  // TelegramIngestionService.processUpdate). Cleared as soon as that next
  // message is consumed, and also cleared if the client navigates to any
  // other menu button first instead of typing.
  @Column({ name: 'telegram_pending_new_ticket', type: 'boolean', default: false })
  telegramPendingNewTicket!: boolean;

  // Accumulates in-progress CSAT answers submitted one question at a time
  // via the Telegram bot's per-question rating buttons (JSON: {ticketId,
  // answers: {[questionId]: score}}) — CsatService.submitAnswers is
  // all-or-nothing (see its own comment on why), so partial taps have to
  // be held somewhere until every enabled question has an answer. Cleared
  // once the full set is submitted. Same one-shot-state shape as
  // telegramPendingNewTicket, just holding a small JSON blob instead of a
  // boolean.
  @Column({ name: 'telegram_csat_draft', type: 'text', nullable: true })
  telegramCsatDraft?: string | null;

  // Set when the client taps «Ответить» on a specific ticket's detail view
  // in the Telegram bot — makes the very NEXT message on this chat append
  // to THIS ticket rather than whichever open Telegram-channel ticket
  // processUpdate's own auto-detect would otherwise pick (see
  // TelegramIngestionService.processUpdate). Not restricted to
  // Telegram-channel tickets — a client can target a reply at any ticket
  // they own, including ones created on the web portal. Cleared as soon as
  // that next message is consumed, and also cleared (same as
  // telegramPendingNewTicket) if the client navigates to any other menu
  // button first instead of typing. No FK: a dangling id from a ticket
  // deleted mid-flow is handled defensively in application code.
  @Column({ name: 'telegram_pending_reply_to_ticket_id', type: 'uuid', nullable: true })
  telegramPendingReplyToTicketId?: string | null;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255, nullable: true })
  refreshTokenHash?: string | null;

  // Self-service interface language — see UsersController PATCH /users/me.
  // Defaults to 'ru' since that's what the UI was hardcoded to before this
  // column existed.
  @Column({ type: 'enum', enum: Locale, default: Locale.RU })
  locale!: Locale;

  // Optional additive permission layer — see PermissionGroupEntity. NULL
  // means "no group", i.e. behaves exactly as before this feature existed.
  // Indexed (AddPermissionGroupIdIndex migration) — filtered/counted on
  // every permission-group list load.
  @Index()
  @Column({ name: 'permission_group_id', type: 'uuid', nullable: true })
  permissionGroupId?: string | null;

  // AES-256-GCM ciphertext (key: TOTP_ENCRYPTION_KEY env var), never the raw
  // TOTP secret — see auth 2FA setup flow. NULL until setup is confirmed.
  @Column({ name: 'totp_secret_encrypted', type: 'varchar', length: 512, nullable: true })
  totpSecretEncrypted?: string | null;

  // Only flips true once the first code is confirmed during setup — a
  // half-configured secret must never be treated as an active 2FA gate.
  @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })
  twoFactorEnabled!: boolean;

  // The employee's manually-picked custom status (see EmployeeStatusEntity).
  // NULL means the default «Онлайн» — chat-service's live presence layer
  // additionally overlays a synthetic, non-persisted «Неактивен» on top of
  // whichever value this holds after an idle timeout; this column itself
  // only ever reflects the last thing the employee actually chose.
  @Column({ name: 'current_status_id', type: 'uuid', nullable: true })
  currentStatusId?: string | null;

  // Set by a contact merge (see ContactsService.merge) — mirrors
  // TicketEntity.mergedIntoId exactly: this row stays in the database
  // (soft-deleted, every ticket/comment/attachment it ever authored already
  // repointed to the survivor) purely as a pointer so the admin UI can show
  // "merged into X" instead of a bare deactivated account.
  @Index()
  @Column({ name: 'merged_into_id', type: 'uuid', nullable: true })
  mergedIntoId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'merged_into_id' })
  mergedInto?: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;

  // Null = awaiting admin approval (see UsersController pending/approve/
  // reject). Only self-service registration (AuthService.register) ever
  // leaves this null — UsersService.createByAdmin sets it immediately,
  // since an admin creating the account has already vetted it, and every
  // account that predates this feature was backfilled to its createdAt.
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  // Null = hasn't completed the mandatory client-onboarding form yet (see
  // UsersService.completeProfile) — client-portal blocks the app behind a
  // non-dismissible modal until this is set. Only ever null for a client
  // who self-registered after this feature shipped; every pre-existing
  // account was backfilled to its createdAt so nobody gets retroactively
  // gated. Meaningless for staff roles (never checked for them).
  @Column({ name: 'profile_completed_at', type: 'timestamptz', nullable: true })
  profileCompletedAt?: Date | null;
}
