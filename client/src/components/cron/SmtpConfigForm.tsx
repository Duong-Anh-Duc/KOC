import { CheckCircleOutlined, MailOutlined, SafetyCertificateOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  FormInstance,
  Input,
  InputNumber,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
  Typography
} from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailApi } from '../../api';
import { toastError, toastSuccess } from '../../utils';

const { Text } = Typography;

interface SmtpConfigFormProps {
  smtpForm: FormInstance;
  emailConfig: any;
  configLoading: boolean;
}

const SmtpConfigForm: React.FC<SmtpConfigFormProps> = ({ smtpForm, emailConfig, configLoading }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState('');

  // Save full SMTP config mutation
  const saveSmtpMutation = useMutation({
    mutationFn: (values: any) => {
      const payload: Record<string, any> = {
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort,
        smtpSecure: values.smtpSecure,
        smtpUser: values.smtpUser,
        fromName: values.fromName,
        fromEmail: values.fromEmail,
      };
      if (values.smtpPass) payload.smtpPass = values.smtpPass;
      return emailApi.updateConfig(payload);
    },
    onSuccess: () => {
      toastSuccess('emailSmtpSaved', t('email.configSaved'));
      queryClient.invalidateQueries({ queryKey: ['email-config'] });
    },
    onError: () => {
      toastError('emailSmtpError', t('email.configSaveError'));
    },
  });

  const updateAutoSendMutation = useMutation({
    mutationFn: (autoSendAfterCron: boolean) => emailApi.updateConfig({ autoSendAfterCron }),
    onSuccess: () => {
      toastSuccess('emailConfigSaved', t('email.configSaved'));
      queryClient.invalidateQueries({ queryKey: ['email-config'] });
    },
    onError: () => {
      toastError('emailConfigError', t('email.configSaveError'));
    },
  });

  // Send test email mutation
  const testMutation = useMutation({
    mutationFn: (email: string) => emailApi.sendTest(email),
    onSuccess: (res) => {
      if (res.data?.data?.success) {
        toastSuccess('emailTestSent', t('email.testSentSuccess'));
      } else {
        toastError('emailTestFailed', t('email.testSentFailed'));
      }
    },
    onError: () => {
      toastError('emailTestError', t('email.testSentFailed'));
    },
  });

  return (
    <Card
      title={
        <Space>
          <MailOutlined />
          {t('email.smtpConfig')}
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Spin spinning={configLoading}>
        {/* Editable SMTP form */}
        <Form
          form={smtpForm}
          layout="vertical"
          onFinish={saveSmtpMutation.mutate}
          initialValues={{ smtpPort: 587, smtpSecure: false }}
        >
          <Form.Item label={t('email.smtpHost')} name="smtpHost" rules={[{ required: true }]}>
            <Input placeholder={t('email.smtpHostPlaceholder')} />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={14} sm={14}>
              <Form.Item label={t('email.smtpPort')} name="smtpPort" rules={[{ required: true }]}>
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={10} sm={10}>
              <Form.Item label={t('email.smtpSecure')} name="smtpSecure" valuePropName="checked">
                <Switch checkedChildren="SSL" unCheckedChildren="STARTTLS" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('email.smtpUser')} name="smtpUser" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder={t('email.smtpUserPlaceholder')} />
          </Form.Item>

          <Form.Item
            label={
              <Space size={4}>
                {t('email.smtpPass')}
                {emailConfig?.smtpPass && (
                  <Tag color="success" style={{ fontSize: 11, marginLeft: 4 }}>{t('email.passSaved')}</Tag>
                )}
              </Space>
            }
            name="smtpPass"
            extra={
              <span style={{ fontSize: 11, color: '#999' }}>{t('email.smtpPassHint')}</span>
            }
          >
            <Input.Password
              placeholder={emailConfig?.smtpPass ? t('email.passKeepCurrent') : t('email.smtpPassPlaceholder')}
              autoComplete="new-password"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item label={t('email.fromName')} name="fromName" rules={[{ required: true }]}>
                <Input placeholder={t('email.fromNamePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={t('email.fromEmail')} name="fromEmail" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder={t('email.fromEmailPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Space>
              {emailConfig?.smtpUser && emailConfig?.smtpPass ? (
                <Tag icon={<CheckCircleOutlined />} color="success">{t('email.configured')}</Tag>
              ) : (
                <Tag color="warning">{t('email.notConfigured')}</Tag>
              )}
            </Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saveSmtpMutation.isPending}
            >
              {t('email.saveSmtp')}
            </Button>
          </div>
        </Form>

        <Divider />

        {/* Auto-send toggle */}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Text strong>{t('email.autoSendAfterCron')}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('email.autoSendAfterCronDesc')}
              </Text>
            </div>
            <Switch
              checked={emailConfig?.autoSendAfterCron}
              onChange={(checked) => updateAutoSendMutation.mutate(checked)}
              loading={updateAutoSendMutation.isPending}
            />
          </Space>
        </Space>

        <Divider />

        {/* Test email */}
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          <SafetyCertificateOutlined style={{ marginRight: 4 }} />
          {t('email.testEmail')}
        </Text>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder={t('email.testEmailPlaceholder')}
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={testMutation.isPending}
            onClick={() => testEmail && testMutation.mutate(testEmail)}
            disabled={!testEmail}
          >
            {t('email.sendTest')}
          </Button>
        </Space.Compact>
      </Spin>
    </Card>
  );
};

export default SmtpConfigForm;
