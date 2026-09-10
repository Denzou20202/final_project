export enum UserRole {
  CLIENT = 'client',
  OPERATOR = 'operator',
  ADMIN = 'admin',
}

// How a user's identity is verified at login. 'local' (bcrypt password) is
// the default for every pre-existing account; 'ldap'/'oidc' accounts are
// directory-provisioned (see UsersService.provisionFromDirectory) and carry
// no usable local password (UserEntity.passwordHash is null for them).
export enum AuthProvider {
  LOCAL = 'local',
  LDAP = 'ldap',
  OIDC = 'oidc',
}

// Which login surface a directory-auth config (LdapConfigEntity/
// OidcConfigEntity) applies to — operator-app staff vs client-portal
// clients. Not a multi-tenant/Company key; a deployment has at most one
// config per provider per audience.
export enum AuthAudience {
  STAFF = 'staff',
  CLIENT = 'client',
}

// The 4 statuses every ticket lifecycle started with — no longer the whole
// status domain (admins can add their own via the `ticket_statuses` table,
// see PublicTicketStatus/TicketStatusEntity). This enum now only names the
// "well-known seed keys": the value of TicketStatusEntity.key on the 4
// seeded rows (always null on admin-created custom statuses), used by the
// migration's INSERT, by frontends/telegram-bot to keep translating these 4
// via existing i18n keys, and by STATUS_EMOJI's compact-marker lookup.
export enum TicketStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// How the ticket entered the system — portal (default) is anything created
// via the web UI/API with an authenticated actor; email/telegram are the
// two inbound-ingestion channels (see ticket-service's email-ingestion and
// telegram-ingestion modules), which auto-resolve/auto-create a client
// user rather than relying on an existing session.
export enum TicketChannel {
  PORTAL = 'portal',
  EMAIL = 'email',
  TELEGRAM = 'telegram',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketType {
  INCIDENT = 'incident',
  SERVICE_REQUEST = 'service_request',
  PROBLEM = 'problem',
  QUESTION = 'question',
}

export enum NotificationType {
  NEW_TICKET = 'new_ticket',
  REPLY = 'reply',
  SLA_BREACH = 'sla_breach',
  ASSIGNMENT = 'assignment',
  STATUS_UPDATE = 'status_update',
  MENTION = 'mention',
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  WEBSOCKET = 'websocket',
}

export enum KnowledgeArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum TicketSortField {
  TICKET_NUMBER = 'ticketNumber',
  TITLE = 'title',
  STATUS = 'status',
  PRIORITY = 'priority',
  CREATED_AT = 'createdAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum CustomFieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  // Stores the id of an existing ticket attachment (uploaded through the
  // same /tickets/:id/attachments endpoint chat/ticket-creation already
  // use, just without a commentId) — no separate file-storage path.
  FILE = 'file',
  // A TEXT-shaped input validated against `pattern` (see
  // CustomFieldDefinitionEntity.pattern) — the admin UI offers phone/email/
  // card-number presets, but the stored pattern is just a plain regex.
  REGEX = 'regex',
}

export enum AutomationTrigger {
  TICKET_CREATED = 'ticket_created',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  CLIENT_REPLIED = 'client_replied',
  SLA_BREACHED = 'sla_breached',
}

export enum AutomationConditionField {
  STATUS = 'status',
  PRIORITY = 'priority',
  TEAM_ID = 'teamId',
  CUSTOM_FIELD = 'customField',
}

export enum AutomationConditionOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
}

export enum AutomationActionType {
  SET_STATUS = 'set_status',
  SET_PRIORITY = 'set_priority',
  ASSIGN_TEAM = 'assign_team',
  ASSIGN_USER = 'assign_user',
  SET_CUSTOM_FIELD = 'set_custom_field',
  APPLY_MACRO = 'apply_macro',
}

// Interface language — self-service, stored on the user's profile so it
// follows them across devices (see UsersController PATCH /users/me).
export enum Locale {
  RU = 'ru',
  UK = 'uk',
  EN = 'en',
}

// Глобальный аудит настроек — distinct from TicketActivityType above (that
// one logs actions on individual tickets; this logs changes to system-wide
// configuration, which has no ticket to attach to).
export enum SettingsAuditModule {
  SLA_POLICY = 'sla_policy',
  PERMISSION_GROUP = 'permission_group',
  CUSTOM_FIELD = 'custom_field',
  AUTOMATION_RULE = 'automation_rule',
  LDAP_CONFIG = 'ldap_config',
  OIDC_CONFIG = 'oidc_config',
}

export enum SettingsAuditEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
}

export enum TicketActivityType {
  CREATED = 'created',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  EDITED = 'edited',
  ATTACHMENT_ADDED = 'attachment_added',
  SLA_RESPONSE_BREACHED = 'sla_response_breached',
  SLA_RESOLUTION_BREACHED = 'sla_resolution_breached',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
  MERGED_INTO = 'merged_into',
  MERGED_FROM = 'merged_from',
  DELETED = 'deleted',
  RESTORED = 'restored',
  STATUS_EMAIL_SENT = 'status_email_sent',
  MESSAGE_EDITED = 'message_edited',
  CSAT_SUBMITTED = 'csat_submitted',
}
