import type {
  AuthAudience,
  AuthProvider,
  AutomationActionType,
  AutomationConditionField,
  AutomationConditionOperator,
  AutomationTrigger,
  CustomFieldType,
  KnowledgeArticleStatus,
  Locale,
  NotificationType,
  PublicTicketStatus,
  PublicTicketType,
  ReportDateField,
  ReportGroupBy,
  ReportPeriodBucket,
  SettingsAuditEventType,
  SettingsAuditModule,
  SortOrder,
  TicketActivityType,
  TicketChannel,
  TicketPriority,
  TicketSortField,
  TicketStatus,
  TicketType,
  UserRole,
} from '@veloxdesk/types';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  // Meaningful only when role === 'admin' — a restricted admin can't create
  // or manage other ADMIN accounts (but a normal admin can still fully
  // manage a restricted admin's own account).
  cannotManageAdmins: boolean;
  // Meaningful only when role === 'client' — admin-toggled, shown as a red
  // sheriff-star badge next to the client's name wherever operators see it.
  isVip: boolean;
  locale: Locale;
  computerName: string | null;
  position: string | null;
  department: string | null;
  company: string | null;
  city: string | null;
  phone: string | null;
  deactivatedAt: string | null;
  permissionGroupId: string | null;
  // False only when the user's group has «наблюдатель» (cannotBeAssignee)
  // set — assignee pickers must filter these out.
  canBeAssignee: boolean;
  // Real team membership (see PublicTeam) — resolved, not stored; a user
  // can technically belong to several teams, but EditUserModal's Отдел
  // dropdown (operator role) only shows/sets one.
  teamId: string | null;
  twoFactorEnabled: boolean;
  // Whether a Telegram chat is bound to this account — see the settings
  // modal's «Telegram» tab. Meaningful for any role, not just clients: an
  // admin links their own Telegram to receive registration-approval pings.
  telegramLinked: boolean;
  // Manually-picked custom status id (see PublicEmployeeStatus), or null
  // for the default «Онлайн». Resolve against useEmployeeStatuses() for
  // the name/color — this field is deliberately just the id.
  currentStatusId: string | null;
  createdAt: string;
  // Set when this contact was merged into another one as a duplicate — see
  // DuplicateContactsModal. Null for every normal, non-merged account.
  mergedIntoId: string | null;
  // Null = awaiting admin approval (self-registration only — see
  // PendingRegistrationsModal). Non-null for every other account.
  approvedAt: string | null;
  // 'local' = has a password, changeable via SecurityTab. 'ldap'/'oidc' =
  // directory-provisioned/linked — SecurityTab hides the change-password
  // form and shows a "managed by your organization's directory" note.
  authProvider: AuthProvider;
}

export interface PublicLdapConfig {
  audience: AuthAudience;
  enabled: boolean;
  url: string;
  bindDn: string;
  hasBindPassword: boolean;
  searchBase: string;
  userFilterTemplate: string;
  emailAttribute: string;
  fullNameAttribute: string;
  externalIdAttribute: string;
  tlsRejectUnauthorized: boolean;
  defaultRole: UserRole;
  lastTestSuccessAt: string | null;
  lastTestError: string | null;
  updatedAt: string;
}

export interface PublicOidcConfig {
  audience: AuthAudience;
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scopes: string;
  emailClaim: string;
  fullNameClaim: string;
  defaultRole: UserRole;
  lastTestSuccessAt: string | null;
  lastTestError: string | null;
  updatedAt: string;
}

export interface AvailableAuthMethods {
  local: boolean;
  ldap: { enabled: boolean };
  oidc: { enabled: boolean; loginUrl?: string };
}

export interface PublicDuplicateGroup {
  groupId: string;
  matchedOn: ('email' | 'phone' | 'name')[];
  contacts: PublicUser[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface PublicUserPage {
  items: PublicUser[];
  nextCursor: string | null;
}

export interface PublicTicket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: PublicTicketStatus;
  priority: TicketPriority;
  type: PublicTicketType;
  channel: TicketChannel;
  createdBy: string;
  createdOnBehalfBy: string | null;
  assignedTo: string | null;
  teamId: string | null;
  categoryId: string | null;
  slaPolicyId: string | null;
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  deletedAt: string | null;
}

export interface PublicTicketPage {
  items: PublicTicket[];
  nextCursor: string | null;
}

export interface PublicTicketActivity {
  id: string;
  actorId: string | null;
  type: TicketActivityType;
  fromValue: string | null;
  toValue: string | null;
  field: string | null;
  createdAt: string;
}

export interface PublicCsatSubmittedAnswer {
  questionText: string;
  score: number;
}

export interface PublicCsatSurvey {
  status: 'not_available' | 'pending' | 'submitted';
  answers?: PublicCsatSubmittedAnswer[];
  submittedAt?: string | null;
}

export interface PublicComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  editedAt: string | null;
}

export interface PublicAttachment {
  id: string;
  ticketId: string;
  uploaderId: string | null;
  commentId: string | null;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export interface TicketEventPayload {
  type: 'created' | 'assigned' | 'reply' | 'mention' | 'updated';
  ticketId: string;
  ticketNumber: number;
  title: string;
  status?: PublicTicketStatus;
  teamId?: string | null;
  assignedTo?: string | null;
  createdBy: string;
  // True only for 'updated' events originating from SLA escalation or rule
  // automation, never a human-initiated edit — see libs/types/ticket-event.ts.
  automated?: boolean;
}

export interface ListTicketsParams {
  statusId?: string;
  priority?: TicketPriority;
  assignedTo?: string;
  teamId?: string;
  tagId?: string;
  watching?: 'me';
  mentioned?: 'me';
  search?: string;
  createdBy?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: TicketSortField;
  sortOrder?: SortOrder;
  limit?: number;
  cursor?: string;
}

export interface PublicTag {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  createdAt: string;
}

export interface PublicTicketCategory {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  createdAt: string;
}

export interface PublicCompany {
  id: string;
  name: string;
  createdAt: string;
}

export interface PublicCity {
  id: string;
  name: string;
  createdAt: string;
}

export interface PublicTicketCounts {
  total: number;
  // Keyed by ticket_statuses.id — see PublicTicketStatus.
  byStatus: Record<string, number>;
}

// Response shape of /tickets/counts/by-team — same as PublicTicketCounts
// plus what the sidebar's per-team accordion needs for the «Неприсвоенные»
// row and the operator drill-down.
export interface PublicTeamTicketCounts extends PublicTicketCounts {
  unassigned: number;
  byAssignee: Record<string, PublicTicketCounts>;
}

export interface TicketSearchResult {
  id: string;
  title: string;
  // ticket_statuses row id — resolve name/color via useTicketStatuses().
  status: string;
  priority: TicketPriority;
  createdAt: string;
  score: number | null;
  highlight: Record<string, string[]>;
}

export interface PublicArticle {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  content: string;
  authorId: string;
  status: KnowledgeArticleStatus;
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface PublicKnowledgeTheme {
  customCss: string | null;
  customJs: string | null;
}

export interface PublicArticlePage {
  items: PublicArticle[];
  nextCursor: string | null;
}

export interface PublicSlaPolicy {
  id: string;
  name: string;
  responseTimeMin: number;
  resolutionTimeMin: number;
  priority: TicketPriority;
}

export interface PublicTeam {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  memberIds: string[];
  createdAt: string;
}

export interface PublicPermissionGroup {
  id: string;
  name: string;
  restrictToDepartments: boolean;
  departmentIds: string[];
  restrictToOwnTickets: boolean;
  cannotBeAssignee: boolean;
  requireTwoFactor: boolean;
  ipWhitelist: string[];
  memberCount: number;
  createdAt: string;
}

export interface PublicEmployeeStatus {
  id: string;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  color: string;
  createdAt: string;
}

export interface PresenceSettings {
  inactivityTimeoutMinutes: number;
}

export interface PublicStatusHistoryEntry {
  id: string;
  statusName: string;
  statusColor: string | null;
  automatic: boolean;
  createdAt: string;
}

export interface PublicMacro {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  body: string;
  createdAt: string;
}

export interface PublicCsatQuestion {
  id: string;
  text: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomFieldDefinition {
  id: string;
  label: string;
  labelUk: string | null;
  labelEn: string | null;
  fieldType: CustomFieldType;
  options: string[] | null;
  pattern: string | null;
  dependsOnFieldId: string | null;
  conditionValue: string | null;
  optionsByParent: Record<string, string[]> | null;
  createdAt: string;
}

export interface PublicTicketCustomFieldValue {
  fieldId: string;
  value: string;
}

export interface AutomationCondition {
  field: AutomationConditionField;
  fieldId?: string;
  operator: AutomationConditionOperator;
  value: string;
}

export interface AutomationAction {
  type: AutomationActionType;
  value?: string;
  fieldId?: string;
  formula?: string;
}

export interface PublicAutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardReport {
  from: string;
  to: string;
  totalTickets: number;
  // Keyed by ticket_statuses.id.
  statusBreakdown: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaComplianceRate: number | null;
}

export interface TeamLoadRow {
  teamId: string | null;
  teamName: string;
  total: number;
  statusCounts: Record<string, number>;
}

export interface TeamLoadReport {
  from: string;
  to: string;
  teams: TeamLoadRow[];
}

export interface ReportFilters {
  statusIds?: string[];
  priorities?: TicketPriority[];
  typeIds?: string[];
  teamId?: string;
  assigneeId?: string;
  clientId?: string;
  company?: string;
  tagId?: string;
  categoryId?: string;
  customFieldId?: string;
  customFieldValue?: string;
  dateField: ReportDateField;
  from?: string;
  to?: string;
  periodBucket?: ReportPeriodBucket;
}

export interface GroupedReportRow {
  entityId: string | null;
  entityName: string;
  total: number;
  statusCounts: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaComplianceRate: number | null;
  weightedKpi: number;
}

export interface GroupedReport {
  groupBy: ReportGroupBy;
  groupLabel: string;
  rows: GroupedReportRow[];
}

export interface SavedReport {
  id: string;
  name: string;
  groupBy: ReportGroupBy;
  filters: ReportFilters;
  columns: string[] | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditSummaryRow {
  key: string | null;
  label: string;
  role: string | null;
  count: number;
}

export interface SettingsAuditLogRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  module: string;
  eventType: string;
  entityId: string | null;
  entityLabel: string;
  changes: Record<string, unknown> | null;
}

export interface CsatQuestionAverageRow {
  questionText: string;
  avgScore: number;
  count: number;
}

export interface CsatOperatorRow {
  assigneeId: string | null;
  assigneeName: string;
  avgScore: number;
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
}

export interface CsatTicketRow {
  ticketId: string;
  ticketNumber: number;
  ticketTitle: string;
  clientName: string;
  assigneeName: string;
  submittedAt: string;
  avgScore: number;
  answerCount: number;
}

export interface CsatSummary {
  overallAvg: number | null;
  totalResponses: number;
  byQuestion: CsatQuestionAverageRow[];
  byOperator: CsatOperatorRow[];
  byTicket: CsatTicketRow[];
}

export interface OperatorStatusTime {
  statusName: string;
  minutes: number;
}

export interface OperatorReportRow {
  assigneeId: string | null;
  assigneeName: string;
  total: number;
  statusCounts: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaComplianceRate: number | null;
  weightedKpi: number;
  statusTime: OperatorStatusTime[];
  responseReturnMinutes: number | null;
  fcrRate: number | null;
}

export interface OperatorReport {
  from: string;
  to: string;
  rows: OperatorReportRow[];
}

export type {
  AutomationActionType,
  AutomationConditionField,
  AutomationConditionOperator,
  AutomationTrigger,
  CustomFieldType,
  KnowledgeArticleStatus,
  Locale,
  NotificationType,
  PublicTicketStatus,
  PublicTicketType,
  ReportDateField,
  ReportGroupBy,
  ReportPeriodBucket,
  SettingsAuditEventType,
  SettingsAuditModule,
  TicketActivityType,
  TicketPriority,
  TicketStatus,
  TicketType,
  UserRole,
};
