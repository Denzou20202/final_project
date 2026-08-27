import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '../lib/types.js';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  setSession: (accessToken: string, refreshToken: string, user: PublicUser) => void;
  setAccessToken: (accessToken: string) => void;
  clear: () => void;
}

// Same storage key as client-portal's auth store, deliberately — both apps
// are served from the same origin (just different path prefixes, / vs
// /staff/), so the shared login page (client-portal's /login) can write a
// session here and a full browser navigation into this app picks it up
// already authenticated, no second login prompt. See ProtectedRoute in
// both apps for the role-based redirect this enables.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'veloxdesk-auth' },
  ),
);
