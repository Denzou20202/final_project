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

export const CLIENT_AUTH_STORAGE_KEY = 'veloxdesk-client-auth';
export const STAFF_AUTH_STORAGE_KEY = 'veloxdesk-staff-auth';

export function saveStaffSessionToLocalStorage(accessToken: string, refreshToken: string, user: PublicUser) {
  try {
    localStorage.setItem(
      STAFF_AUTH_STORAGE_KEY,
      JSON.stringify({
        state: { accessToken, refreshToken, user },
        version: 0,
      }),
    );
  } catch (err) {
    console.error('Failed to save staff session to storage', err);
  }
}

// Client portal uses a distinct localStorage key to prevent session collisions
// with operator-app on the same origin (e.g. https://localhost:8443).
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
    { name: CLIENT_AUTH_STORAGE_KEY },
  ),
);

