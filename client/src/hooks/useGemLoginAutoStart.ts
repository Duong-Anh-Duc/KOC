import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { gemloginApi } from '../api';
import { useAuthStore } from '../stores';

/**
 * Tự động kiểm tra và khởi động GemLogin khi vào hệ thống.
 * Chỉ chạy cho staff (ADMIN/ACCOUNTANT), bỏ qua KOC.
 */
export function useGemLoginAutoStart() {
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'; // VIEWER excluded - read-only
  const startedRef = useRef(false);

  const { data: statusRes, isLoading } = useQuery({
    queryKey: ['gemlogin-status'],
    queryFn: () => gemloginApi.getStatus(),
    refetchInterval: 15_000,
    enabled: isStaff,
    staleTime: 5_000,
  });

  const status = statusRes?.data;
  const isRunning = status?.isRunning ?? false;
  const isStarting = !isRunning && isLoading;

  // Auto-start một lần khi phát hiện chưa chạy
  useEffect(() => {
    if (!isStaff) return;
    if (isLoading) return;
    if (isRunning) { startedRef.current = true; return; }
    if (startedRef.current) return;

    startedRef.current = true;
    // Fire-and-forget — không await, không hiển thị lỗi nếu GemLogin chưa cài
    gemloginApi.start().catch(() => {
      startedRef.current = false; // cho phép retry lần sau
    });
  }, [isStaff, isRunning, isLoading]);

  return { isRunning, isStarting, activeProfileId: status?.activeProfileId };
}
