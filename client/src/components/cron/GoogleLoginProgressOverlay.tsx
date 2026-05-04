import { CheckCircleFilled, CloseCircleFilled, GoogleOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Modal, Progress, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgressState } from '../../hooks/useProgress';

const { Title, Text } = Typography;

interface Props {
  state: ProgressState;
  onClose: () => void;
}

/**
 * Fullscreen overlay theo dõi quá trình auto-login Google.
 * Hiện step text từ backend: "Đang nhập mật khẩu...", "Đang lấy TOTP từ 2fa.live...", v.v.
 */
const GoogleLoginProgressOverlay: React.FC<Props> = ({ state, onClose }) => {
  const { t } = useTranslation();
  const open = state.active || state.completed || !!state.error;
  if (!open) return null;

  const percent = state.progress?.percent ?? (state.completed ? 100 : 0);
  const message = state.progress?.message ?? t('googleLogin.progressInitializing');
  const result = state.result as { loggedIn?: boolean; message?: string } | null;
  const loggedIn = result?.loggedIn === true;

  let icon: React.ReactNode;
  let title: string;
  if (state.error) {
    icon = <CloseCircleFilled style={{ fontSize: 48, color: '#ff4d4f' }} />;
    title = t('googleLogin.progressErrorTitle');
  } else if (state.completed) {
    if (loggedIn) {
      icon = <CheckCircleFilled style={{ fontSize: 48, color: '#52c41a' }} />;
      title = t('googleLogin.progressSuccessTitle');
    } else {
      icon = <CloseCircleFilled style={{ fontSize: 48, color: '#ff4d4f' }} />;
      title = t('googleLogin.progressFailTitle');
    }
  } else {
    icon = <LoadingOutlined style={{ fontSize: 48, color: '#4285f4' }} spin />;
    title = t('googleLogin.progressConnecting');
  }

  return (
    <Modal
      open={open}
      footer={null}
      closable={!state.active}
      maskClosable={false}
      onCancel={onClose}
      centered
      width={520}
      destroyOnClose
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ marginBottom: 16, position: 'relative', display: 'inline-block' }}>
          {icon}
          <GoogleOutlined
            style={{
              position: 'absolute',
              right: -8,
              bottom: -8,
              fontSize: 20,
              background: '#fff',
              borderRadius: '50%',
              padding: 2,
              color: '#4285f4',
              border: '2px solid #fff',
            }}
          />
        </div>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          {title}
        </Title>

        <Progress
          percent={percent}
          status={state.error ? 'exception' : state.completed ? (loggedIn ? 'success' : 'exception') : 'active'}
          showInfo
          style={{ marginBottom: 16, marginTop: 16 }}
        />

        <div
          style={{
            minHeight: 48,
            padding: '12px 16px',
            background: '#fafafa',
            borderRadius: 8,
            textAlign: 'left',
            border: '1px solid #f0f0f0',
          }}
        >
          {state.error ? (
            <Text type="danger" style={{ fontSize: 13 }}>
              {state.error}
            </Text>
          ) : state.completed ? (
            <Text type={loggedIn ? 'success' : 'danger'} strong style={{ fontSize: 13 }}>
              {result?.message || (loggedIn
                ? t('googleLogin.progressDoneFallback')
                : t('googleLogin.progressFailFallback'))}
            </Text>
          ) : (
            <Text style={{ fontSize: 13 }}>
              <Text strong>
                {t('googleLogin.progressStepLabel', {
                  step: state.progress?.step ?? 0,
                  total: state.progress?.total ?? 8,
                })}
              </Text>{' '}
              {message}
            </Text>
          )}
        </div>

        {(state.completed || state.error) && (
          <Button type="primary" onClick={onClose} style={{ marginTop: 16 }}>
            {t('googleLogin.progressCloseButton')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default GoogleLoginProgressOverlay;
