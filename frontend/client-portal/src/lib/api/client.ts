import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../store/auth.store.js';
import type { AuthResponse } from '../types.js';

const USER_SERVICE_URL = import.meta.env['VITE_USER_SERVICE_URL'] ?? 'http://localhost:3002/api';
export const TICKET_SERVICE_URL = import.meta.env['VITE_TICKET_SERVICE_URL'] ?? 'http://localhost:3011/api';
const KNOWLEDGE_SERVICE_URL = import.meta.env['VITE_KNOWLEDGE_SERVICE_URL'] ?? 'http://localhost:3006/api';
// Public by design (baked into the built JS bundle and read straight out of
// the page's own HTML by Cloudflare's widget) — the actual secret lives
// only in TURNSTILE_SECRET_KEY, server-side. See RegisterPage/LoginPage.
export const TURNSTILE_SITE_KEY = import.meta.env['VITE_TURNSTILE_SITE_KEY'] ?? '';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Concurrent 401s (e.g. a page firing several requests at once) must share a
// single in-flight refresh call, not each trigger their own — otherwise the
// second refresh call invalidates the token the first one just rotated in.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setSession, clear } = useAuthStore.getState();
  if (!refreshToken) {
    clear();
    throw new Error('No refresh token available');
  }

  try {
    // Plain axios, not the intercepted instance — a 401 on the refresh call
    // itself must not re-enter this same retry logic.
    const { data } = await axios.post<AuthResponse>(`${USER_SERVICE_URL}/auth/refresh`, { refreshToken });
    setSession(data.accessToken, data.refreshToken, data.user);
    return data.accessToken;
  } catch (error) {
    clear();
    throw error;
  }
}

function attachAuthInterceptors(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetryableRequestConfig | undefined;

      // A 401 from login/register/refresh itself is a real credential
      // rejection (wrong password, deactivated account, expired refresh
      // token) — not an expired access token to silently refresh around.
      // Retrying it used to call refreshAccessToken() with no refresh
      // token yet, which threw a plain Error that replaced the backend's
      // actual message ("Учётная запись деактивирована" etc.) with a
      // generic "something went wrong" on every failed login.
      const isAuthEndpoint = /\/auth\/(login|register|refresh)$/.test(originalRequest?.url ?? '');

      if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newToken = await refreshPromise;
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return instance(originalRequest);
      } catch (refreshError) {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    },
  );

  return instance;
}

export const userApi = attachAuthInterceptors(axios.create({ baseURL: USER_SERVICE_URL }));
export const ticketApi = attachAuthInterceptors(axios.create({ baseURL: TICKET_SERVICE_URL }));

// Optionally authenticated, not the full attachAuthInterceptors() treatment:
// the public FAQ surface (/public/articles/*) never requires a token and
// never rejects one with 401 (see OptionalJwtAuthGuard on the backend), so
// there's nothing to retry/refresh — this just rides along whatever token
// happens to be in the store so a logged-in client also gets private
// (isPublic=false) articles mixed into the same listing. A logged-out
// visitor sends no header and gets the public-only set, as before.
export const publicKnowledgeApi = axios.create({ baseURL: KNOWLEDGE_SERVICE_URL });
publicKnowledgeApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});
