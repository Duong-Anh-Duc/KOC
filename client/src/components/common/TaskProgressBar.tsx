import type { ProgressState } from '@/hooks/useProgress';
import { CloseOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';

const { Text } = Typography;

interface TaskProgressBarProps {
  state: ProgressState;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

const TaskProgressBar: React.FC<TaskProgressBarProps> = ({ state, onDismiss, style }) => {
  const { t } = useTranslation();
  const darkMode = useAppStore((s) => s.darkMode);

  if (!state.active && !state.completed && !state.error) {
    return null;
  }

  const percent = state.progress?.percent ?? 0;
  const message = state.progress?.message || '';
  // Only show step info when there is a meaningful total (avoids "(0/0)").
  const stepInfo = state.progress && (state.progress.total ?? 0) > 0
    ? `${state.progress.step}/${state.progress.total}`
    : '';

  const errorText = state.error
    ? (state.error.startsWith('progress.') ? t(state.error) : state.error)
    : '';

  // --- Active: floating widget at bottom-right (does NOT block the screen) ---
  // Portal to body so it escapes any transform/overflow containers.
  if (state.active) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    return createPortal(
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 2000,
          width: 300,
          maxWidth: 'calc(100vw - 32px)',
          background: darkMode ? '#1f1f1f' : '#ffffff',
          border: `1px solid ${darkMode ? '#303030' : '#e8e8e8'}`,
          borderRadius: 12,
          boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
          padding: 16,
        }}
      >
        {/* Header: spinner + title + percent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <LoadingOutlined style={{ color: '#1677ff', fontSize: 16 }} spin />
          <Text strong style={{ fontSize: 13, flex: 1, color: darkMode ? '#fff' : undefined }}>
            {t('progress.processing', 'Đang xử lý...')}
          </Text>
          <Text strong style={{ fontSize: 15, color: '#1677ff' }}>{pct}%</Text>
        </div>

        {/* Progress bar */}
        <div className="native-progress-track">
          <div className="native-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Message + step */}
        {(message || stepInfo) && (
          <div style={{ marginTop: 8 }}>
            <Text
              style={{
                fontSize: 12,
                color: darkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={message}
            >
              {message}
            </Text>
            {stepInfo && (
              <Text style={{ fontSize: 11, color: darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
                ({stepInfo})
              </Text>
            )}
          </div>
        )}
      </div>,
      document.body
    );
  }

  // --- Completed or error: small dismissible bar ---
  return (
    <div
      style={{
        background: state.error ? '#fff2f0' : '#f6ffed',
        border: `1px solid ${state.error ? '#ffccc7' : '#b7eb8f'}`,
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 13 }}>
          {state.error
            ? `${t('progress.error')}: ${errorText}`
            : t('progress.completed')}
        </Text>
        {onDismiss && (
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onDismiss} />
        )}
      </div>
      <div className="native-progress-track native-progress-track-inline">
        <div
          className="native-progress-fill"
          style={{ width: '100%', background: state.error ? '#ff4d4f' : '#52c41a' }}
        />
      </div>
    </div>
  );
};

export default TaskProgressBar;
