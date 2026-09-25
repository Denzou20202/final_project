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

export const STAFF_AUTH_STORAGE_KEY = 'veloxdesk-staff-auth';

// Operator app uses its own distinct localStorage key to prevent session collisions
// with client-portal when accessed from the same origin (e.g. https://localhost:8443).
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
    { name: STAFF_AUTH_STORAGE_KEY },
  ),
);
