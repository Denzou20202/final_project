import { userApi } from './client.js';
import type { Locale, PublicUser } from '../types.js';

export async function fetchMe(): Promise<PublicUser> {
  const { data } = await userApi.get<PublicUser>('/users/me');
  return data;
}

// A partial patch (not one param per field) — ProfileTab and LanguageTab
// each save independently, and neither should have to resend the other's
// current value just to avoid overwriting it.
export async function updateOwnProfile(patch: {
  computerName?: string;
  phone?: string;
  locale?: Locale;
}): Promise<PublicUser> {
  const { data } = await userApi.patch<PublicUser>('/users/me', patch);
  return data;
}

// Mandatory onboarding form — unlike updateOwnProfile above, every field
// except computerName is required (enforced server-side).
export async function completeProfile(data: {
  position: string;
  department: string;
  company: string;
  city: string;
  phone: string;
  computerName?: string;
}): Promise<PublicUser> {
  const { data: user } = await userApi.patch<PublicUser>('/users/me/complete-profile', data);
  return user;
}

export async function createTelegramLinkToken(): Promise<{ link: string; expiresAt: string }> {
  const { data } = await userApi.post<{ link: string; expiresAt: string }>('/users/me/telegram-link-token');
  return data;
}
