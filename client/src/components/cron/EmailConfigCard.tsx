import { useProgress } from '@/hooks/useProgress';
import { CheckCircleOutlined, MailOutlined, SafetyCertificateOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailApi } from '../../api';
import { toastError, toastSuccess } from '../../utils';
import { TaskProgressBar } from '../common';

const { Text } = Typography;

interface EmailConfigCardProps {
  onSendingChange?: (isSending: boolean) => void;
}

const EmailConfigCard: React.FC<EmailConfigCardProps> = ({ onSendingChange }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [sendResultModal, setSendResultModal] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);
  const [smtpForm] = Form.useForm();

  // Fetch email config
  const { data: configRes, isLoading: configLoading } = useQuery({
    queryKey: ['email-config'],
    queryFn: async () => {
      const res = await emailApi.getConfig();
      return res.data;
    },
  });

  // Fetch available cycles
  const { data: cyclesRes } = useQuery({
    queryKey: ['email-cycles'],
    queryFn: async () => {
      const res = await emailApi.getCycles();
      return res.data;
    },
  });

  const emailConfig = configRes?.data;
  const cycles = cyclesRes?.data || [];

  // Sync config into form when loaded
  useEffect(() => {
    if (emailConfig) {
      smtpForm.setFieldsValue({
        smtpHost: emailConfig.smtpHost || '',
        smtpPort: emailConfig.smtpPort || 587,
        smtpSecure: emailConfig.smtpSecure ?? false,
        smtpUser: emailConfig.smtpUser || '',
        smtpPass: emailConfig.smtpPass || '',
        fromName: emailConfig.fromName || '',
        fromEmail: emailConfig.fromEmail || '',
      });
    }
  }, [emailConfig, smtpForm]);

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

  // SSE Progress for sending revenue emails
  const emailProgress = useProgress((result: unknown) => {
    onSendingChange?.(false);
    const data = result as Record<string, any>;
    if (data) {
      setSendResults(data);
      setSendResultModal(true);
      toastSuccess('emailRevenueSent', t('email.revenueSentSuccess', {
        sent: data.sent?.length || data.summary?.totalSent || 0,
        failed: data.failed?.length || data.summary?.totalFailed || 0,
      }));
    }
    queryClient.invalidateQueries({ queryKey: ['email-cycles'] });
  });

  // Send revenue emails mutation
  const sendRevenueMutation = useMutation({
    mutationFn: (month: string) => {
      onSendingChange?.(true);
      return emailApi.sendRevenueEmails(month);
    },
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) {
        emailProgress.startTask(taskId);
      } else {
        onSendingChange?.(false);
      }
    },
    onError: () => {
      onSendingChange?.(false);
      toastError('emailRevenueError', t('email.revenueSentFailed'));
    },
  });

  return (
    <>
      <Row gutter={16}>
        {/* SMTP Configuration Info (Read-only) */}
        <Col xs={24} lg={12}>
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
        </Col>

        {/* Send Revenue Emails */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SendOutlined />
                {t('email.sendRevenueTitle')}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Alert
              type="info"
              showIcon
              message={t('email.sendRevenueDesc')}
              style={{ marginBottom: 16 }}
            />

            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('email.selectCycle')}
            </Text>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Select
                placeholder={t('email.selectCyclePlaceholder')}
                value={selectedMonth || undefined}
                onChange={setSelectedMonth}
                style={{ flex: 1 }}
                options={cycles.map((c: any) => ({
                  value: c.month,
                  label: `${c.month} - ${c.status} (${c.recordCount} ${t('email.records')})`,
                }))}
              />
              <Button
                type="primary"
                danger
                icon={<SendOutlined />}
                loading={sendRevenueMutation.isPending || emailProgress.state.active}
                onClick={() => {
                  if (selectedMonth) {
                    Modal.confirm({
                      title: t('email.confirmSend'),
                      content: t('email.confirmSendDesc', { month: selectedMonth }),
                      okText: t('email.sendNow'),
                      cancelText: t('common.cancel'),
                      okButtonProps: { danger: true },
                      onOk: () => sendRevenueMutation.mutate(selectedMonth),
                    });
                  }
                }}
                disabled={!selectedMonth}
              >
                {t('email.sendAll')}
              </Button>
            </Space.Compact>

            {/* SSE Progress Bar for email sending */}
            <TaskProgressBar state={emailProgress.state} onDismiss={emailProgress.reset} />

            {/* Cycle records preview */}
            {cycles.length > 0 && (
              <Table
                dataSource={cycles}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: t('email.month'),
                    dataIndex: 'month',
                    width: 100,
                  },
                  {
                    title: t('common.status'),
                    dataIndex: 'status',
                    width: 100,
                    render: (status: string) => {
                      const color = status === 'PAYMENT_COMPLETED' ? 'green' : status === 'LOCKED' ? 'orange' : 'blue';
                      return <Tag color={color}>{t(`status.${status}`, status)}</Tag>;
                    },
                  },
                  {
                    title: t('email.records'),
                    dataIndex: 'recordCount',
                    width: 80,
                    align: 'center' as const,
                  },
                  {
                    title: t('common.actions'),
                    width: 100,
                    render: (_: any, record: any) => (
                      <Button
                        type="link"
                        size="small"
                        icon={<SendOutlined />}
                        loading={sendRevenueMutation.isPending}
                        onClick={() => {
                          Modal.confirm({
                            title: t('email.confirmSend'),
                            content: t('email.confirmSendDesc', { month: record.month }),
                            okText: t('email.sendNow'),
                            cancelText: t('common.cancel'),
                            okButtonProps: { danger: true },
                            onOk: () => sendRevenueMutation.mutate(record.month),
                          });
                        }}
                      >
                        {t('email.send')}
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Send Results Modal */}
      <Modal
        title={t('email.sendResults')}
        open={sendResultModal}
        onCancel={() => setSendResultModal(false)}
        footer={[
          <Button key="close" onClick={() => setSendResultModal(false)}>
            {t('common.close')}
          </Button>,
        ]}
        width={700}
      >
        {sendResults && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', borderColor: '#52c41a' }}>
                  <Text type="secondary">{t('email.sent')}</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                    {sendResults.sent?.length || 0}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', borderColor: '#ff4d4f' }}>
                  <Text type="secondary">{t('email.failed')}</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>
                    {sendResults.failed?.length || 0}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', borderColor: '#faad14' }}>
                  <Text type="secondary">{t('email.skipped')}</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>
                    {sendResults.skipped?.length || 0}
                  </div>
                </Card>
              </Col>
            </Row>

            {sendResults.sent?.length > 0 && (
              <>
                <Text strong style={{ color: '#52c41a' }}>{t('email.sentList')}</Text>
                <Table
                  dataSource={sendResults.sent}
                  rowKey="kocId"
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8, marginBottom: 16 }}
                  columns={[
                    { title: t('email.kocName'), dataIndex: 'kocName' },
                    { title: t('email.emailAddress'), dataIndex: 'email' },
                  ]}
                />
              </>
            )}

            {sendResults.failed?.length > 0 && (
              <>
                <Text strong style={{ color: '#ff4d4f' }}>{t('email.failedList')}</Text>
                <Table
                  dataSource={sendResults.failed}
                  rowKey="kocId"
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8, marginBottom: 16 }}
                  columns={[
                    { title: t('email.kocName'), dataIndex: 'kocName' },
                    { title: t('email.emailAddress'), dataIndex: 'email' },
                    { title: t('common.errors'), dataIndex: 'error' },
                  ]}
                />
              </>
            )}

            {sendResults.skipped?.length > 0 && (
              <>
                <Text strong style={{ color: '#faad14' }}>{t('email.skippedList')}</Text>
                <Table
                  dataSource={sendResults.skipped}
                  rowKey="kocId"
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  columns={[
                    { title: t('email.kocName'), dataIndex: 'kocName' },
                    { title: t('email.reason'), dataIndex: 'reason' },
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default EmailConfigCard;
