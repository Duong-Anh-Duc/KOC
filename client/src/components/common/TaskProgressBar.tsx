import type { ProgressState } from '@/hooks/useProgress';
import { CloseOutlined } from '@ant-design/icons';
import { Button, Progress, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface TaskProgressBarProps {
  state: ProgressState;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

const TaskProgressBar: React.FC<TaskProgressBarProps> = ({ state, onDismiss, style }) => {
  const { t } = useTranslation();

  if (!state.active && !state.completed && !state.error) {
    return null;
  }

  const percent = state.progress?.percent ?? 0;
  const message = state.progress?.message || '';
  const stepInfo = state.progress ? `${state.progress.step}/${state.progress.total}` : '';

  const errorText = state.error
    ? (state.error.startsWith('progress.') ? t(state.error) : state.error)
    : '';

  // --- Active: full-page loading overlay ---
  if (state.active) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* Percentage circle */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: '3px solid rgba(255,255,255,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {Math.round(percent)}%
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ width: 320 }}>
          <Progress
            percent={Math.round(percent)}
            status="active"
            strokeColor={{ from: '#1677ff', to: '#52c41a' }}
            trailColor="rgba(255,255,255,0.2)"
            showInfo={false}
          />
        </div>

        {/* Message + step */}
        <div style={{ textAlign: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, display: 'block' }}>{message}</Text>
          {stepInfo && (
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              ({stepInfo})
            </Text>
          )}
        </div>
      </div>
    );
  }

  // --- Completed or error: small dismissible bar ---
  let status: 'success' | 'exception' = state.error ? 'exception' : 'success';

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
      <Progress
        percent={100}
        status={status}
        size="small"
        strokeColor={state.error ? '#ff4d4f' : '#52c41a'}
      />
    </div>
  );
};

export default TaskProgressBar;
