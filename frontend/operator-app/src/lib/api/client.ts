import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../store/auth.store.js';
import type { AuthResponse } from '../types.js';

const USER_SERVICE_URL = import.meta.env['VITE_USER_SERVICE_URL'] ?? 'http://localhost:3002/api';
export const TICKET_SERVICE_URL = import.meta.env['VITE_TICKET_SERVICE_URL'] ?? 'http://localhost:3011/api';
const KNOWLEDGE_SERVICE_URL = import.meta.env['VITE_KNOWLEDGE_SERVICE_URL'] ?? 'http://localhost:3006/api';
const ANALYTICS_SERVICE_URL = import.meta.env['VITE_ANALYTICS_SERVICE_URL'] ?? 'http://localhost:3005/api';

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
          // operator-app is staff-only (ProtectedRoute redirects any client
          // role straight back out) — see that component's comment on why
          // the shared LoginPage needs this signal.
          window.location.href = '/login?portal=staff';
        }
        return Promise.reject(refreshError);
      }
    },
  );

  return instance;
}

export const userApi = attachAuthInterceptors(axios.create({ baseURL: USER_SERVICE_URL }));
export const ticketApi = attachAuthInterceptors(axios.create({ baseURL: TICKET_SERVICE_URL }));
export const knowledgeApi = attachAuthInterceptors(axios.create({ baseURL: KNOWLEDGE_SERVICE_URL }));
export const analyticsApi = attachAuthInterceptors(axios.create({ baseURL: ANALYTICS_SERVICE_URL }));
