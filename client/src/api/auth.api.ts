import type {
    ApiResponse,
    AuthUser,
    LoginInput,
} from '../types';
import apiClient from './client';

// ============================================================
// AUTH API
// ============================================================
export const authApi = {
  login: (data: LoginInput) =>
    apiClient.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/login', data),

  getProfile: () =>
    apiClient.get<ApiResponse<AuthUser>>('/auth/profile'),

  register: (data: { email: string; password: string; full_name: string; role?: string }) =>
    apiClient.post<ApiResponse<AuthUser>>('/auth/register', data),
};
