import type {
    ApiResponse,
    AuthUser,
    LoginInput,
} from '../types';
import apiClient from './client';

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';
  is_active: boolean;
  created_at: string;
}

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

  updateProfile: (data: { full_name?: string; email?: string }) =>
    apiClient.put<ApiResponse<AuthUser>>('/auth/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post<ApiResponse>('/auth/change-password', data),

  refresh: () =>
    apiClient.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/refresh'),

  logout: () =>
    apiClient.post<ApiResponse>('/auth/logout'),

  forgotPassword: (email: string) =>
    apiClient.post<ApiResponse>('/auth/forgot-password', { email }),

  verifyOtp: (data: { email: string; otp: string }) =>
    apiClient.post<ApiResponse>('/auth/verify-otp', data),

  resetPassword: (data: { email: string; otp: string; newPassword: string }) =>
    apiClient.post<ApiResponse>('/auth/reset-password', data),

  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get<ApiResponse<{
      data: StaffUser[];
      total: number;
      page: number;
      limit: number;
      stats: { activeCount: number; accountantCount: number; viewerCount: number };
    }>>('/auth/users', { params }),

  updateUser: (id: string, data: { full_name?: string; email?: string; role?: string }) =>
    apiClient.put<ApiResponse<StaffUser>>(`/auth/users/${id}`, data),

  toggleUserActive: (id: string, is_active: boolean) =>
    apiClient.patch<ApiResponse<StaffUser>>(`/auth/users/${id}/active`, { is_active }),

  deleteUser: (id: string) =>
    apiClient.delete<ApiResponse>(`/auth/users/${id}`),
};
