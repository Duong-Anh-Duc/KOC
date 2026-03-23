import { useEffect, useState } from 'react';
import { permissionApi, type MyPermissionsData } from '../api/permission.api';
import { useAuthStore } from '../stores';

const EMPTY: MyPermissionsData = { accessible_koc_ids: [], per_koc: {}, aggregated: [] };

let cachedData: MyPermissionsData | null = null;
let cacheUserId: string | null = null;

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<MyPermissionsData>(cachedData || EMPTY);
  const [loading, setLoading] = useState(!cachedData || cacheUserId !== user?.userId);

  useEffect(() => {
    if (!user) return;

    if (cachedData && cacheUserId === user.userId) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    permissionApi.getMyPermissions().then((res) => {
      if (cancelled) return;
      const d = res.data.data || EMPTY;
      cachedData = d;
      cacheUserId = user.userId;
      setData(d);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user]);

  /** Check if user has a specific permission (aggregated across all KOCs) */
  const hasPermission = (perm: string) => {
    if (user?.role === 'ADMIN') return true;
    return data.aggregated.includes(perm);
  };

  /** Check if user has a permission for a specific KOC */
  const hasKocPermission = (kocId: string, perm: string) => {
    if (user?.role === 'ADMIN') return true;
    const perms = data.per_koc[kocId];
    return perms ? perms.includes(perm) : false;
  };

  /** Check if user has access to any KOC */
  const hasAnyAccess = () => {
    if (user?.role === 'ADMIN') return true;
    return data.accessible_koc_ids.length > 0;
  };

  const refreshPermissions = async () => {
    try {
      const res = await permissionApi.getMyPermissions();
      const d = res.data.data || EMPTY;
      cachedData = d;
      cacheUserId = user?.userId || null;
      setData(d);
    } catch { /* ignore */ }
  };

  return {
    accessibleKocIds: data.accessible_koc_ids,
    perKoc: data.per_koc,
    aggregated: data.aggregated,
    loading,
    hasPermission,
    hasKocPermission,
    hasAnyAccess,
    refreshPermissions,
  };
}

/** Clear permission cache (e.g. on logout) */
export function clearPermissionCache() {
  cachedData = null;
  cacheUserId = null;
}
