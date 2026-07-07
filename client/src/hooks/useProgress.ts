import { useCallback, useRef, useState } from 'react';
import type { ProgressEvent } from '../types';
import { getProgressErrorMessage } from '../utils/progressError';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ProgressState {
  taskId: string | null;
  active: boolean;
  progress: ProgressEvent | null;
  completed: boolean;
  result: unknown;
  error: string | null;
}

/**
 * Hook for subscribing to SSE progress events from the server.
 * Usage:
 *   const { state, startTask, reset } = useProgress();
 *   const handleAction = async () => {
 *     const res = await api.someAction(); // returns { taskId }
 *     startTask(res.data.data.taskId);
 *   };
 */
export function useProgress(onComplete?: (result: unknown) => void) {
  const [state, setState] = useState<ProgressState>({
    taskId: null,
    active: false,
    progress: null,
    completed: false,
    result: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const completedRef = useRef(false);
  const lastProgressAtRef = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    completedRef.current = false;
    lastProgressAtRef.current = 0;
    setState({
      taskId: null,
      active: false,
      progress: null,
      completed: false,
      result: null,
      error: null,
    });
  }, [cleanup]);

  const startTask = useCallback((taskId: string) => {
    cleanup();
    completedRef.current = false;

    setState({
      taskId,
      active: true,
      progress: null,
      completed: false,
      result: null,
      error: null,
    });

    const url = `${API_BASE_URL}/progress/${taskId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('progress', (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        const now = Date.now();
        if ((data.percent ?? 0) < 100 && now - lastProgressAtRef.current < 500) {
          return;
        }
        lastProgressAtRef.current = now;
        setState(prev => ({ ...prev, progress: data }));
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        // Unwrap the actual result from the SSE envelope ({ ..., result: <actual_data> })
        const actualResult = data?.result ?? data;
        completedRef.current = true;
        setState(prev => ({
          ...prev,
          active: false,
          completed: true,
          result: actualResult,
          progress: prev.progress
            ? { ...prev.progress, percent: 100 }
            : { step: 1, total: 1, percent: 100, message: 'Done' },
        }));
        onComplete?.(actualResult);
      } catch {
        completedRef.current = true;
        setState(prev => ({ ...prev, active: false, completed: true }));
      }
      es.close();
    });

    es.addEventListener('error', (event) => {
      const msgEvent = event as MessageEvent;
      if (msgEvent.data) {
        // Server chủ động gửi error event (có data) → terminal, đóng connection
        try {
          const data = JSON.parse(msgEvent.data);
          setState(prev => ({
            ...prev,
            active: false,
            error: getProgressErrorMessage(data.message, taskId),
          }));
        } catch {
          setState(prev => ({ ...prev, active: false, error: getProgressErrorMessage(null, taskId) }));
        }
        es.close();
        return;
      }

      // Native connection error (network blip) — đã completed thì bỏ qua,
      // chưa thì để EventSource tự reconnect (KHÔNG set error + KHÔNG close).
      if (completedRef.current) {
        es.close();
      }
      // Else: browser tự retry với exponential backoff. Giữ nguyên state.
    });
  }, [cleanup, onComplete]);

  return { state, startTask, reset, cleanup };
}
