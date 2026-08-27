import { PublicUser } from '../users/user.public.js';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

// Returned by POST /auth/login instead of AuthResponse when the account has
// 2FA enabled — no tokens issued yet, the client must follow up with
// POST /auth/2fa/verify using this challengeToken.
export interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  challengeToken: string;
}

// Returned by POST /auth/login instead of AuthResponse when the account's
// permission group requires 2FA but it isn't set up yet — the client must
// run the setup flow (POST /auth/2fa/setup-required, then
// POST /auth/2fa/confirm-required) using this setupToken before any tokens
// are issued.
export interface TwoFactorSetupRequiredResponse {
  requiresTwoFactorSetup: true;
  setupToken: string;
}

export type LoginResult = AuthResponse | TwoFactorChallengeResponse | TwoFactorSetupRequiredResponse;

// Returned by POST /auth/register — self-registration always requires admin
// approval now, so no tokens are issued at registration time. userId feeds
// POST /auth/registration-status (the waiting-screen poll).
export interface PendingRegistrationResponse {
  pending: true;
  userId: string;
}

// Returned by POST /auth/registration-status while still awaiting a
// decision, or once rejected (see UsersService.reject — a rejected
// registration is hard-deleted, so "rejected" here really means "the row is
// gone", not a flag on it).
export interface RegistrationStillPendingResponse {
  approved: false;
  rejected: boolean;
}

// Approved, with a session — only within
// AuthService.REGISTRATION_AUTO_LOGIN_WINDOW_MS of approval (see that
// constant's comment for why the window exists).
export interface RegistrationApprovedResponse extends AuthResponse {
  approved: true;
}

// Approved, but outside the auto-login window — the frontend must fall back
// to a normal password login instead of expecting a session here.
export interface RegistrationApprovedNoSessionResponse {
  approved: true;
}

// Approved, within the auto-login window, but the account already has 2FA
// enabled — getRegistrationStatus is nothing more than an alternate
// token-issuance path (see its own comment), so it applies the exact same
// gate completeLogin does here instead of handing out tokens outright.
// Mirrors TwoFactorChallengeResponse above; the client follows up with
// POST /auth/2fa/verify using this challengeToken, same as after a normal
// login.
export interface RegistrationApprovedTwoFactorChallengeResponse {
  approved: true;
  requiresTwoFactor: true;
  challengeToken: string;
}

// Approved, within the auto-login window, but the account's permission
// group requires 2FA and it isn't set up yet. Mirrors
// TwoFactorSetupRequiredResponse above; the client runs the same setup flow
// (POST /auth/2fa/setup-required, then /2fa/confirm-required) using this
// setupToken before any tokens are issued.
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
