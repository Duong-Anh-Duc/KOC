import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes - for long scraping operations
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Always send cookies (refresh_token HttpOnly cookie)
});

// ============================================================
// REQUEST INTERCEPTOR — attach access token from memory
// ============================================================
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const locale = localStorage.getItem('locale') || 'vi';
    config.headers['Accept-Language'] = locale;

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ============================================================
// RESPONSE INTERCEPTOR — auto-refresh on 401
// ============================================================
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];
let hasShownSuspendedMessage = false;

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const data = error.response?.data as any;

    if (error.response?.status === 403 && data?.code === 'ACCOUNT_SUSPENDED') {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/forgot-password')) {
        return Promise.reject(error);
      }
      if (!hasShownSuspendedMessage) {
        hasShownSuspendedMessage = true;
        message.error(data?.message || 'Email này tạm thời bị dừng hoạt động');
      }
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      // YouTube session expired — don't logout user
      if (data?.code === 'NOT_LOGGED_IN') {
        window.dispatchEvent(new CustomEvent('yt-session-expired'));
        return Promise.reject(error);
      }

      // Don't retry the refresh endpoint itself to avoid infinite loop
      if (originalRequest.url?.includes('/auth/refresh')) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await apiClient.post<{ success: boolean; data: { token: string; user: any } }>('/auth/refresh');
        const { token, user } = res.data.data;
        useAuthStore.getState().setAuth(user, token);
        processQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
