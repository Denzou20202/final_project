import type { AuthAudience, Locale } from '@veloxdesk/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  availableAuthMethods,
  changeOwnPassword,
  confirmTwoFactorRequired,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  registrationStatus,
  setupTwoFactorRequired,
  verifyTwoFactor,
} from '../lib/api/auth.api.js';
import { completeProfile, createTelegramLinkToken, fetchMe, updateOwnProfile } from '../lib/api/users.api.js';
import { disconnectChatSocket } from '../lib/socket.js';
import { useAuthStore } from '../store/auth.store.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}

export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOwnProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// "Подключить Telegram" (ProfileTab) — no `['me']` invalidation here on
// purpose: `me.telegramLinked` only flips to true once the client actually
// taps the returned link and completes /start in Telegram (an out-of-band
// action this mutation can't know happened), so there's nothing fresh to
// refetch immediately after this call succeeds.
export function useCreateTelegramLinkToken() {
  return useMutation({ mutationFn: createTelegramLinkToken });
}

// «Мои настройки → Безопасность» — self-service password change, any
// role. No ['me'] invalidation needed: nothing about the returned user
// object changes from a password swap.
export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword, totpCode }: { currentPassword: string; newPassword: string; totpCode?: string }) =>
      changeOwnPassword(currentPassword, newPassword, totpCode),
  });
}

// Only fires when `picked` is set — i.e. the person actually clicked a
// language on the Login/Register screen's AuthPreferencesBar, not just
// whatever locale ambient browser/localStorage detection happened to land
// on. Syncing on ambient detection too would silently overwrite someone's
// real saved preference the first time they log in from a machine with a
// different OS/browser language.
function syncPickedLocale(
  updateProfile: ReturnType<typeof useUpdateOwnProfile>,
  picked: Locale | undefined,
  actual: Locale,
): void {
  if (picked && picked !== actual) {
    updateProfile.mutate({ locale: picked });
  }
}

// Mandatory onboarding form — see OnboardingModal.
export function useCompleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// Returns the raw LoginResult (tokens, or a 2FA challenge/setup marker).
// Only sets the session for the plain-tokens shape — a challenge/setup
// response means the login isn't actually finished yet, so LoginPage reads
// the returned shape itself to decide which step to show next.
export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const updateProfile = useUpdateOwnProfile();
  return useMutation({
    mutationFn: ({
      email,
      password,
      audience,
      captchaToken,
    }: {
      email: string;
      password: string;
      locale?: Locale;
      audience?: AuthAudience;
      captchaToken?: string;
    }) => loginRequest(email, password, audience, captchaToken),
    onSuccess: (result, variables) => {
      if ('accessToken' in result) {
        setSession(result.accessToken, result.refreshToken, result.user);
        syncPickedLocale(updateProfile, variables.locale, result.user.locale);
      }
    },
  });
}

// LoginPage calls this before rendering its form — see
// AvailableAuthMethodsController. Public/unauthenticated, so no `enabled`
// gate on a session the way useCurrentUser has.
export function useAvailableAuthMethods(audience: AuthAudience) {
  return useQuery({
    queryKey: ['available-auth-methods', audience],
    queryFn: () => availableAuthMethods(audience),
    staleTime: 60_000,
  });
}

// Completes a login that returned a 2FA challenge.
export function useVerifyTwoFactor() {
  const setSession = useAuthStore((s) => s.setSession);
  const updateProfile = useUpdateOwnProfile();
  return useMutation({
    mutationFn: ({ challengeToken, token }: { challengeToken: string; token: string; locale?: Locale }) =>
      verifyTwoFactor(challengeToken, token),
    onSuccess: (data, variables) => {
      setSession(data.accessToken, data.refreshToken, data.user);
      syncPickedLocale(updateProfile, variables.locale, data.user.locale);
    },
  });
}

// Generates a secret for a login that returned a forced-setup marker — not
// yet persisted server-side (see auth.service.ts), just shown as a QR.
export function useSetupTwoFactorRequired() {
  return useMutation({
    mutationFn: (setupToken: string) => setupTwoFactorRequired(setupToken),
  });
}

// Confirms the code for a forced setup and completes the login in one step.
export function useConfirmTwoFactorRequired() {
  const setSession = useAuthStore((s) => s.setSession);
  const updateProfile = useUpdateOwnProfile();
  return useMutation({
    mutationFn: ({
      setupToken,
      secret,
      token,
    }: {
      setupToken: string;
      secret: string;
      token: string;
      locale?: Locale;
    }) => confirmTwoFactorRequired(setupToken, secret, token),
    onSuccess: (data, variables) => {
      setSession(data.accessToken, data.refreshToken, data.user);
      syncPickedLocale(updateProfile, variables.locale, data.user.locale);
    },
  });
}

// Self-registration always requires admin approval now — no session is set
// here anymore. RegisterPage owns the step transition (form → waiting →
// approved/rejected) based on the returned userId; see useRegistrationStatus.
export function useRegister() {
  return useMutation({
    mutationFn: ({
      email,
      password,
      fullName,
      captchaToken,
      locale,
    }: {
      email: string;
      password: string;
      fullName: string;
      captchaToken: string;
      locale?: Locale;
    }) => registerRequest(email, password, fullName, captchaToken, locale),
  });
}

// Drives the waiting screen — polls every 3s until a terminal state
// (approved or rejected) is reached, then stops itself.
export function useRegistrationStatus(userId: string | null) {
  return useQuery({
    queryKey: ['registration-status', userId],
    queryFn: () => registrationStatus(userId as string),
    enabled: !!userId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (data.approved) return false;
      return data.rejected ? false : 3000;
    },
    // The admin approving this registration has nothing to do with whether
    // THIS tab happens to be focused right now — react-query's default
    // (pause polling in a background tab) would mean someone who alt-tabs
    // away while waiting simply never finds out.
    refetchIntervalInBackground: true,
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clear();
      disconnectChatSocket();
      queryClient.clear();
      // Not user-scoped in storage — must be wiped on logout, or the next
      // person to log in on this browser inherits the previous client's
      // highlighted status folders.
      useSidebarHighlightStore.getState().clearAll();
      useRecentActivityStore.getState().clearAll();
      navigate('/login', { replace: true });
    },
  });
}
