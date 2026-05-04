import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { googleLoginApi } from '../api';
import { useAuthStore } from '../stores';
import { useProgress } from './useProgress';

/**
 * Trạng thái Google login — đọc DB từ backend (nhẹ, không mở browser).
 *
 * Hook KHÔNG poll interval — chỉ refetch khi user focus lại window.
 * Khi user bấm `checkNow()` → trigger backend mở browser + auto-login nếu cần,
 * progress events stream về qua SSE (`progress` field).
 */
export function useGoogleLoginStatus() {
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['google-login-status'],
    queryFn: () => googleLoginApi.getGoogleStatus(),
    enabled: isStaff,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  const onComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['google-login-status'] });
  }, [queryClient]);

  const progress = useProgress(onComplete);

  const checkNow = useCallback(async () => {
    progress.reset();
    const res = await googleLoginApi.checkGoogleStatusNow();
    const taskId = res.data?.taskId;
    if (taskId) progress.startTask(taskId);
  }, [progress]);

  const body = data?.data;
  return {
    loggedIn: body?.loggedIn ?? false,
    verifiedAt: body?.verifiedAt ?? null,
    disconnectedAt: body?.disconnectedAt ?? null,
    message: body?.message ?? null,
    isLoading,
    refetch,
    checkNow,
    isChecking: progress.state.active,
    progress: progress.state,
    resetProgress: progress.reset,
  };
}
