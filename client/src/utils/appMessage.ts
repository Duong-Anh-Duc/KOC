import type React from 'react';
import { toast } from 'react-toastify';
import type { ToastOptions } from 'react-toastify';

// AntD-compatible shim for `message` static API. Routes to react-toastify
// (already in the project) so we drop AntD's CSS-in-JS message popup.

type Content = React.ReactNode | string;

const buildOpts = (duration?: number, onClose?: () => void): ToastOptions => ({
  autoClose: duration != null ? duration * 1000 : 3000,
  onClose,
});

export const appMessage = {
  success: (content: Content, duration?: number, onClose?: () => void) =>
    toast.success(content as string, buildOpts(duration, onClose)),
  error: (content: Content, duration?: number, onClose?: () => void) =>
    toast.error(content as string, buildOpts(duration, onClose)),
  warning: (content: Content, duration?: number, onClose?: () => void) =>
    toast.warn(content as string, buildOpts(duration, onClose)),
  warn: (content: Content, duration?: number, onClose?: () => void) =>
    toast.warn(content as string, buildOpts(duration, onClose)),
  info: (content: Content, duration?: number, onClose?: () => void) =>
    toast.info(content as string, buildOpts(duration, onClose)),
  loading: (content: Content, duration?: number, onClose?: () => void) => {
    const id = toast.loading(content as string, { autoClose: duration ? duration * 1000 : false, onClose });
    // AntD returns a destroy() function
    return () => toast.dismiss(id);
  },
  open: (cfg: { type?: 'success' | 'error' | 'warning' | 'info' | 'loading'; content: Content; duration?: number; onClose?: () => void }) => {
    const fn = (appMessage as any)[cfg.type || 'info'];
    return fn(cfg.content, cfg.duration, cfg.onClose);
  },
  destroy: (_key?: string | number) => toast.dismiss(),
  // AntD `useMessage()` hook compat — return [api, contextHolder] pair
  // (react-toastify doesn't need a context holder; return empty fragment)
};

interface NotificationCfg {
  message?: React.ReactNode;
  description?: React.ReactNode;
  duration?: number | null;
  onClose?: () => void;
  key?: string;
  btn?: React.ReactNode;
  icon?: React.ReactNode;
  placement?: string;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

const buildNotifContent = (cfg: NotificationCfg) => {
  if (cfg.message && cfg.description) {
    return `${cfg.message} — ${cfg.description}`;
  }
  return (cfg.message ?? cfg.description ?? '') as string;
};

export const appNotification = {
  success: (cfg: NotificationCfg) => toast.success(buildNotifContent(cfg), buildOpts(cfg.duration ?? undefined, cfg.onClose)),
  error: (cfg: NotificationCfg) => toast.error(buildNotifContent(cfg), buildOpts(cfg.duration ?? undefined, cfg.onClose)),
  warning: (cfg: NotificationCfg) => toast.warn(buildNotifContent(cfg), buildOpts(cfg.duration ?? undefined, cfg.onClose)),
  info: (cfg: NotificationCfg) => toast.info(buildNotifContent(cfg), buildOpts(cfg.duration ?? undefined, cfg.onClose)),
  open: (cfg: NotificationCfg & { type?: 'success' | 'error' | 'warning' | 'info' }) => {
    const fn = (appNotification as any)[cfg.type || 'info'];
    return fn(cfg);
  },
  destroy: (_key?: string) => toast.dismiss(),
};
