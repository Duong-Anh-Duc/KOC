import { useCallback, useRef, useState } from 'react';
import type { ProgressEvent } from '../types';

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

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    completedRef.current = false;
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
      try {
        const msgEvent = event as MessageEvent;
        if (msgEvent.data) {
          // Named 'error' event from server
          const data = JSON.parse(msgEvent.data);
          setState(prev => ({
            ...prev,
            active: false,
            error: data.message || 'progress.unknownError',
          }));
        } else {
          // Native EventSource connection error - ignore if already completed
          if (!completedRef.current) {
            setState(prev => {
              if (prev.completed) return prev;
              return { ...prev, active: false, error: 'progress.connectionLost' };
            });
          }
        }
      } catch {
        if (!completedRef.current) {
          setState(prev => {
            if (prev.completed) return prev;
            return { ...prev, active: false, error: 'progress.connectionError' };
          });
        }
      }
      es.close();
    });
  }, [cleanup, onComplete]);

  return { state, startTask, reset, cleanup };
}
