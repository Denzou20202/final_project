import { userApi } from './client.js';

// No login() here — operator-app has no login form of its own; the shared
// /login page lives in client-portal (see useAuth.ts / ProtectedRoute.tsx).

export async function logout(): Promise<void> {
  await userApi.post('/auth/logout');
}

// ===== 2FA self-service (operator/admin's own account, «Мои настройки → Безопасность») =====

export async function setupTwoFactor(): Promise<{ secret: string; otpauthUri: string }> {
  const { data } = await userApi.post<{ secret: string; otpauthUri: string }>('/auth/2fa/setup');
  return data;
}

export async function confirmTwoFactor(secret: string, token: string): Promise<void> {
  await userApi.post('/auth/2fa/confirm', { secret, token });
}

export async function disableTwoFactor(password: string, token: string): Promise<void> {
  await userApi.post('/auth/2fa/disable', { password, token });
}

// Any role — client/operator/admin all change their own password through
// this one self-service route (no @Roles() on the backend). Distinct from
// the admin-only /users/:id/password path used to reset SOMEONE ELSE's
// password from the Users list.
export async function changeOwnPassword(currentPassword: string, newPassword: string, totpCode?: string): Promise<void> {
  await userApi.post('/auth/change-password', { currentPassword, newPassword, totpCode });
}
