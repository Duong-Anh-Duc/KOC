import { CheckCircleTwoTone, CloseCircleTwoTone, GoogleOutlined, SyncOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Space, Switch, Tag, Tooltip, Typography, message } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { googleLoginApi } from '../../api';
import { useGoogleLoginStatus } from '../../hooks';
import GoogleLoginProgressOverlay from './GoogleLoginProgressOverlay';

const { Text, Paragraph } = Typography;

const GoogleLoginConfigCard: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const status = useGoogleLoginStatus();

  const { data: configRes, isLoading } = useQuery({
    queryKey: ['google-login-config'],
    queryFn: () => googleLoginApi.getConfig(),
  });
  const config = configRes?.data?.data;

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        email: config.email || '',
        password: config.password || '',
        totpSecret: config.totpSecret || '',
        autoLoginEnabled: config.autoLoginEnabled,
      });
    }
  }, [config, form]);

  const saveMutation = useMutation({
    mutationFn: googleLoginApi.updateConfig,
    onSuccess: () => {
      message.success(t('googleLogin.saveSuccess'));
      form.setFieldsValue({ password: '', totpSecret: '' });
      queryClient.invalidateQueries({ queryKey: ['google-login-config'] });
      queryClient.invalidateQueries({ queryKey: ['google-login-status'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || err.message || t('googleLogin.saveError'));
    },
  });

  const onSave = (values: any) => {
    const payload: any = {
      email: values.email || null,
      autoLoginEnabled: !!values.autoLoginEnabled,
    };
    if ((values.password || '') !== (config?.password || '')) {
      payload.password = values.password || null;
    }
    if ((values.totpSecret || '') !== (config?.totpSecret || '')) {
      payload.totpSecret = values.totpSecret || null;
    }
    saveMutation.mutate(payload);
  };

  return (
    <>
      <Card
        title={
          <Space wrap>
            <GoogleOutlined style={{ color: '#4285f4' }} />
            <span>{t('googleLogin.title')}</span>
            {config?.autoLoginEnabled
              ? <Tag color="green">{t('googleLogin.configEnabled')}</Tag>
              : <Tag>{t('googleLogin.configDisabled')}</Tag>}
            {status.loggedIn
              ? <Tag color="success">{t('googleLogin.sessionOK')}</Tag>
              : <Tag color="warning">{t('googleLogin.sessionNeedLogin')}</Tag>}
          </Space>
        }
        extra={
          <Tooltip title={t('googleLogin.checkSessionTooltip')}>
            <Button
              icon={<SyncOutlined spin={status.isChecking} />}
              onClick={() => status.checkNow()}
              loading={status.isChecking}
              disabled={saveMutation.isPending}
            >
              {t('googleLogin.checkSessionButton')}
            </Button>
          </Tooltip>
        }
        loading={isLoading}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('googleLogin.infoTitle')}
          description={
            <Paragraph style={{ marginBottom: 0 }}>
              {t('googleLogin.infoDescription')}
              <br />
              <Text strong>{t('googleLogin.totpHelpLabel')}</Text>: {t('googleLogin.totpHelpBefore')}
              <a href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noreferrer">
                {t('googleLogin.totpHelpLink')}
              </a>
              {t('googleLogin.totpHelpAfter')}
            </Paragraph>
          }
        />

        <Form form={form} layout="vertical" onFinish={onSave} disabled={saveMutation.isPending}>
          <Form.Item
            label={t('googleLogin.emailLabel')}
            name="email"
            rules={[{ type: 'email', message: t('googleLogin.emailInvalid') }]}
          >
            <Input placeholder={t('googleLogin.emailPlaceholder')} autoComplete="off" />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <span>{t('googleLogin.passwordLabel')}</span>
                {config?.hasPassword ? (
                  <Tag icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} color="success">{t('googleLogin.set')}</Tag>
                ) : (
                  <Tag icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} color="error">{t('googleLogin.notSet')}</Tag>
                )}
              </Space>
            }
            name="password"
            extra={t('googleLogin.passwordExtra')}
          >
            <Input.Password placeholder={t('googleLogin.passwordPlaceholder')} autoComplete="new-password" visibilityToggle />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <span>{t('googleLogin.totpLabel')}</span>
                {config?.hasTotpSecret ? (
                  <Tag icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} color="success">{t('googleLogin.set')}</Tag>
                ) : (
                  <Tag icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} color="error">{t('googleLogin.notSet')}</Tag>
                )}
              </Space>
            }
            name="totpSecret"
            extra={t('googleLogin.totpExtra')}
          >
            <Input.Password placeholder={t('googleLogin.totpPlaceholder')} autoComplete="off" visibilityToggle />
          </Form.Item>

          <Form.Item
            label={t('googleLogin.autoLoginLabel')}
            name="autoLoginEnabled"
            valuePropName="checked"
            extra={t('googleLogin.autoLoginExtra')}
          >
            <Switch />
          </Form.Item>

          {config?.lastResult && (
            <Alert
              type={config.lastResult.startsWith('OK') ? 'success' : 'error'}
              showIcon
              message={t('googleLogin.lastAttempt', { result: config.lastResult })}
              description={config.lastAttemptAt
                ? t('googleLogin.lastAttemptAt', { time: new Date(config.lastAttemptAt).toLocaleString() })
                : null}
              style={{ marginBottom: 16 }}
            />
          )}

          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
            {t('googleLogin.saveButton')}
          </Button>
        </Form>
      </Card>

      <GoogleLoginProgressOverlay state={status.progress} onClose={status.resetProgress} />
    </>
  );
};

export default GoogleLoginConfigCard;
