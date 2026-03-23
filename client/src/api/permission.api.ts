import type { ApiResponse } from '../types';
import apiClient from './client';

export interface ManagerUser {
  id: string;
  full_name: string;
  email: string;
}

export interface KocItem {
  id: string;
  full_name: string;
  channel_name: string;
  admin_id: string | null;
  admin: { full_name: string } | null;
}

export interface KocAccessEntry {
  koc_id: string;
  permissions: string[];
}

export interface KocPermDef {
  key: string;
  label: string;
  group: 'basic' | 'advanced';
}

export interface PermissionsPageData {
  managerKocAccess: Record<string, KocAccessEntry[]>;
  managers: ManagerUser[];
  kocs: KocItem[];
  kocPermissionDefinitions: KocPermDef[];
}

export interface MyPermissionsData {
  accessible_koc_ids: string[];
  per_koc: Record<string, string[]>;
  aggregated: string[];
}

export const permissionApi = {
  getPermissions: () =>
    apiClient.get<ApiResponse<PermissionsPageData>>('/permissions'),

  toggleKocAccess: (managerId: string, kocId: string, enabled: boolean) =>
    apiClient.put<ApiResponse>(`/permissions/manager/${managerId}/koc/${kocId}/toggle`, { enabled }),

  updateKocPermissions: (managerId: string, kocId: string, permissions: string[]) =>
    apiClient.put<ApiResponse>(`/permissions/manager/${managerId}/koc/${kocId}/permissions`, { permissions }),

  bulkToggle: (managerId: string, kocIds: string[], enabled: boolean) =>
    apiClient.put<ApiResponse>(`/permissions/manager/${managerId}/bulk`, { kocIds, enabled }),

  getMyPermissions: () =>
    apiClient.get<ApiResponse<MyPermissionsData>>('/permissions/my'),
};
