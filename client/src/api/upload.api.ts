import type { ApiResponse } from '../types';
import apiClient from './client';

export const uploadApi = {
  /** Upload KOC avatar (Admin only) */
  uploadKocAvatar: (kocId: string, file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post<ApiResponse<{ avatar_url: string }>>(`/upload/koc/${kocId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Upload User avatar (own profile) */
  uploadUserAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post<ApiResponse<{ avatar_url: string }>>('/upload/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
