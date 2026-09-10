import type {
  AuthProvider,
  Locale,
  PublicTicketStatus,
  SortOrder,
  TicketActivityType,
  TicketPriority,
  TicketSortField,
  UserRole,
} from '@veloxdesk/types';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  locale: Locale;
  computerName: string | null;
  position: string | null;
  department: string | null;
  company: string | null;
  city: string | null;
  phone: string | null;
  createdAt: string;
  // Null = hasn't completed the mandatory onboarding form yet — see
  // OnboardingModal / useCompleteProfile. Every pre-existing account was
  // backfilled server-side, so this only ever matters for a freshly
  // self-registered client.
  profileCompletedAt: string | null;
  // Whether a Telegram chat is bound to this account — see ProfileTab's
  // "Подключить Telegram" section.
  telegramLinked: boolean;
  // Org-mandated via the client's permission group (requireTwoFactor),
  // forced at login — clients have no self-service toggle for this, but
  // SecurityTab's password-change form still needs to know whether to ask
  // for a TOTP code.
  twoFactorEnabled: boolean;
  // 'local' = has a password, changeable via SecurityTab. 'ldap'/'oidc' =
  // directory-provisioned/linked — SecurityTab hides the change-password
  // form and shows a "managed by your organization's directory" note.
  authProvider: AuthProvider;
}

export interface AvailableAuthMethods {
  local: boolean;
  ldap: { enabled: boolean };
  oidc: { enabled: boolean; loginUrl?: string };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

// Returned by POST /auth/login instead of AuthResponse when the account has
// 2FA enabled — no tokens yet, follow up with POST /auth/2fa/verify.
export interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  challengeToken: string;
}

// Returned instead of AuthResponse when the account's permission group
// requires 2FA but it isn't set up yet — run the setup flow
// (POST /auth/2fa/setup-required, then /auth/2fa/confirm-required) before
// any tokens are issued.
export interface TwoFactorSetupRequiredResponse {
  requiresTwoFactorSetup: true;
  setupToken: string;
}

export type LoginResult = AuthResponse | TwoFactorChallengeResponse | TwoFactorSetupRequiredResponse;

// Returned by POST /auth/register — self-registration now always requires
// admin approval, so no tokens are issued at registration time. userId feeds
// POST /auth/registration-status (the waiting-screen poll).
export interface PendingRegistrationResponse {
  pending: true;
  userId: string;
}

// Returned by POST /auth/registration-status while still awaiting a
// decision, or once rejected — a rejected registration is hard-deleted
// server-side, so "rejected" here really means "the row is gone".
export interface RegistrationStillPendingResponse {
  approved: false;
  rejected: boolean;
}

// Approved, with a session — only within ~15 minutes of approval (the admin
// clicked «Активировать» while this tab was plausibly still open/polling).
export interface RegistrationApprovedResponse extends AuthResponse {
  approved: true;
}

// Approved, but outside that window — the tab must fall back to a normal
// password login instead of expecting a session here.
export interface RegistrationApprovedNoSessionResponse {
  approved: true;
}

// Approved, within the auto-login window, but the account already has 2FA
// enabled — mirrors TwoFactorChallengeResponse above; hand off to LoginPage
// with this challengeToken the same way OidcCallbackPage already does.
export interface RegistrationApprovedTwoFactorChallengeResponse {
  approved: true;
  requiresTwoFactor: true;
  challengeToken: string;
}

// Approved, within the auto-login window, but the account's permission
// group requires 2FA and it isn't set up yet — mirrors
// TwoFactorSetupRequiredResponse above; hand off to LoginPage with this
// setupToken the same way OidcCallbackPage already does.
export interface RegistrationApprovedTwoFactorSetupRequiredResponse {
  approved: true;
  requiresTwoFactorSetup: true;
  setupToken: string;
}

export type RegistrationStatusResponse =
  | RegistrationStillPendingResponse
  | RegistrationApprovedResponse
  | RegistrationApprovedNoSessionResponse
  | RegistrationApprovedTwoFactorChallengeResponse
  | RegistrationApprovedTwoFactorSetupRequiredResponse;

export interface PublicTicket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: PublicTicketStatus;
  priority: TicketPriority;
  createdBy: string;
  assignedTo: string | null;
  teamId: string | null;
  categoryId: string | null;
  slaPolicyId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  deletedAt: string | null;
  // Set once this ticket has been merged into another one (see
  // TicketsService.merge in ticket-service) — points at the surviving
  // ticket. TicketDetailPage redirects there automatically when set.
  mergedIntoId: string | null;
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
  createdAt: string;
}

export interface PublicCsatQuestionOption {
  id: string;
  text: string;
}

export interface PublicCsatSubmittedAnswer {
  questionText: string;
  score: number;
}

export interface PublicCsatSurvey {
  status: 'not_available' | 'pending' | 'submitted';
  questions?: PublicCsatQuestionOption[];
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
  type: 'created' | 'assigned' | 'reply' | 'updated';
  ticketId: string;
  ticketNumber: number;
  title: string;
  status?: PublicTicketStatus;
  // Present on the shared backend payload (libs/types/ticket-event.ts) —
  // needed here so the sidebar highlight can route an unassigned open
  // ticket's activity to «Новые» instead of «В работе», same split as
  // StatusBadge's own `unassigned` prop.
  assignedTo?: string | null;
}

export interface ListTicketsParams {
  statusId?: string;
  priority?: TicketPriority;
  watching?: 'me';
  search?: string;
  sortBy?: TicketSortField;
  sortOrder?: SortOrder;
  limit?: number;
  cursor?: string;
  // 'unassigned' | 'assigned' — powers the «Новые»/«В работе» split for the
  // status=open folder; the server still scopes everything to the client's
  // own tickets regardless (see tickets.service.ts's list()).
  assignedTo?: string;
}

export interface PublicTicketCounts {
  total: number;
  // Keyed by ticket_statuses.id — see PublicTicketStatus.
  byStatus: Record<string, number>;
}

export interface PublicArticle {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  content: string;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface PublicArticlePage {
  items: PublicArticle[];
  nextCursor: string | null;
}

export interface PublicKnowledgeTheme {
  customCss: string | null;
  customJs: string | null;
}

export interface ArticleSearchResult {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  score: number | null;
  highlight: Record<string, string[]>;
}

export type { Locale, PublicTicketStatus, TicketActivityType, TicketPriority, UserRole };
