import type { AuthAudience, Locale } from '@veloxdesk/types';
import { userApi } from './client.js';
import type { AuthResponse, AvailableAuthMethods, LoginResult, PendingRegistrationResponse, RegistrationStatusResponse } from '../types.js';

export async function register(
  email: string,
  password: string,
  fullName: string,
  captchaToken: string,
  locale?: Locale,
): Promise<PendingRegistrationResponse> {
  const { data } = await userApi.post<PendingRegistrationResponse>('/auth/register', {
    email,
    password,
    fullName,
    locale,
    captchaToken,
  });
  return data;
}

// Polled by the waiting screen. userId travels in the body (not a :userId
// path param) so it never sits in a URL/access log — see backend
// RegistrationStatusDto's comment.
export async function registrationStatus(userId: string): Promise<RegistrationStatusResponse> {
  const { data } = await userApi.post<RegistrationStatusResponse>('/auth/registration-status', { userId });
  return data;
}

export async function login(
  email: string,
  password: string,
  audience?: AuthAudience,
  captchaToken?: string,
): Promise<LoginResult> {
  const { data } = await userApi.post<LoginResult>('/auth/login', { email, password, audience, captchaToken });
  return data;
}

// Public, unauthenticated — LoginPage calls this before rendering its form
// so it knows whether to show a password field, an LDAP-flavored credentials
// form (same fields, different routing server-side), an "Sign in with SSO"
// button, or some combination. See AvailableAuthMethodsController.
export async function availableAuthMethods(audience: AuthAudience): Promise<AvailableAuthMethods> {
  const { data } = await userApi.get<AvailableAuthMethods>('/auth/available-methods', { params: { audience } });
  return data;
}

export async function logout(): Promise<void> {
  await userApi.post('/auth/logout');
}

export async function verifyTwoFactor(challengeToken: string, token: string): Promise<AuthResponse> {
  const { data } = await userApi.post<AuthResponse>('/auth/2fa/verify', { challengeToken, token });
  return data;
}

export async function setupTwoFactorRequired(setupToken: string): Promise<{ secret: string; otpauthUri: string }> {
  const { data } = await userApi.post<{ secret: string; otpauthUri: string }>('/auth/2fa/setup-required', {
    setupToken,
  });
  return data;
}

export async function confirmTwoFactorRequired(setupToken: string, secret: string, token: string): Promise<AuthResponse> {
  const { data } = await userApi.post<AuthResponse>('/auth/2fa/confirm-required', { setupToken, secret, token });
  return data;
}

// Any role — same self-service route operator-app's admin/operator use for
// their own password (no @Roles() on the backend). Distinct from an admin
// resetting a locked-out client's password from «Настройки → Пользователи»
// — that stays a separate, staff-only path for account recovery.
export async function changeOwnPassword(currentPassword: string, newPassword: string, totpCode?: string): Promise<void> {
  await userApi.post('/auth/change-password', { currentPassword, newPassword, totpCode });
}
