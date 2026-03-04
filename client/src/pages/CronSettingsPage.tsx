import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ImportOutlined,
  LinkOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Col, Form, Input, Modal, notification, Popconfirm, Row, Space, Spin, Tooltip, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cronApi, ytScraperApi } from '../api';
import { SummaryBar } from '../components/common';
import { CronConfigCard, CronStatusCard, RunHistoryTable } from '../components/cron';
import { toastError, toastSuccess } from '../utils';

const { Title } = Typography;

/**
 * Parse cron expression to day, hour, minute
 */
const parseCronExpression = (cronExpr: string): { day: number; hour: number; minute: number } => {
  const parts = cronExpr.split(' ');
  return {
    minute: parseInt(parts[0]) || 0,
    hour: parseInt(parts[1]) || 0,
    day: parseInt(parts[2]) || 1,
  };
};

const CronSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);

  /**
   * Convert day, hour, minute to cron expression for API
   */
  const getCronExpression = () => `${minute} ${hour} ${day} * *`;

  const {
    data: configResponse,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['cron-config'],
    queryFn: async () => {
      const res = await cronApi.getConfig();
      return res.data;
    },
  });

  const { data: previewResponse } = useQuery({
    queryKey: ['cron-preview'],
    queryFn: async () => {
      const res = await cronApi.previewNextRun();
      return res.data;
    },
  });

  const config = configResponse?.data;
  const preview = previewResponse?.data;

  useEffect(() => {
    if (config) {
      const parsed = parseCronExpression(config.schedule || '0 0 1 * *');
      setDay(parsed.day);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      form.setFieldsValue({
        enabled: config.enabled,
        autoCreateCycle: config.autoCreateCycle,
        autoScrapeRevenue: config.autoScrapeRevenue,
      });
    }
  }, [config, form]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      enabled?: boolean;
      schedule?: string;
      autoCreateCycle?: boolean;
      autoScrapeRevenue?: boolean;
    }) => cronApi.updateConfig(data),
    onSuccess: () => {
      toastSuccess('cronConfigUpdated', t('cron.configSaved'));
      queryClient.invalidateQueries({ queryKey: ['cron-config'] });
    },
    onError: () => {
      toastError('cronConfigError', t('cron.configSaveError'));
    },
  });

  const runNowMutation = useMutation({
    mutationFn: () => cronApi.runNow(),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.success) {
        toastSuccess('cronRunSuccess', t('cron.runSuccess', { month: data.cycleMonth || '' }));
      } else {
        toastError('cronRunFailed', data?.message || t('cron.runFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['cron-config'] });
      queryClient.invalidateQueries({ queryKey: ['cron-preview'] });
    },
    onError: () => {
      toastError('cronRunError', t('cron.runFailed'));
    },
  });

  const handleSave = () => {
    form.validateFields().then((values) => {
      updateMutation.mutate({
        ...values,
        schedule: getCronExpression(),
      });
    });
  };

  const handleEnabledChange = (checked: boolean) => {
    form.setFieldValue('enabled', checked);
    updateMutation.mutate({
      enabled: checked,
      schedule: getCronExpression(),
      autoCreateCycle: config?.autoCreateCycle,
      autoScrapeRevenue: config?.autoScrapeRevenue,
    });
  };

  const handleAutoCreateCycleChange = (checked: boolean) => {
    form.setFieldValue('autoCreateCycle', checked);
    updateMutation.mutate({
      enabled: config?.enabled,
      schedule: getCronExpression(),
      autoCreateCycle: checked,
      autoScrapeRevenue: config?.autoScrapeRevenue,
    });
  };

  const handleAutoScrapeRevenueChange = (checked: boolean) => {
    form.setFieldValue('autoScrapeRevenue', checked);
    updateMutation.mutate({
      enabled: config?.enabled,
      schedule: getCronExpression(),
      autoCreateCycle: config?.autoCreateCycle,
      autoScrapeRevenue: checked,
    });
  };

  const runHistory = config?.runHistory || [];

  const isLoading = runNowMutation.isPending;
  const loadingTip = t('cron.runningNow');

  // YouTube Scraper - Status check — poll every 3s while waiting for user to login
  const [waitingForLogin, setWaitingForLogin] = React.useState(false);
  const [loginBrowserOpen, setLoginBrowserOpen] = React.useState(false);
  const {
    data: statusData,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['yt-scraper-status'],
    queryFn: async () => {
      const res = await ytScraperApi.checkStatus();
      const data = res.data?.data;
      setLoginBrowserOpen(!!data?.loginBrowserOpen);
      if (data?.loggedIn && waitingForLogin) {
        setWaitingForLogin(false);
        notification.destroy('vnc-login');
        toastSuccess('ytLoginSuccess', t('ytScraper.loginSuccess'));
      }
      return data;
    },
    retry: false,
    refetchInterval: (waitingForLogin || loginBrowserOpen) ? 3000 : false,
  });

  // Auto-connect on first load
  useQuery({
    queryKey: ['yt-scraper-auto-connect'],
    queryFn: async () => {
      const res = await ytScraperApi.autoConnect();
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      }
      return res.data?.data;
    },
    retry: false,
  });

  const isLoggedIn = statusData?.loggedIn ?? false;

  // Auto-fetch account info when logged in but no info cached yet
  const refreshAccountInfoMutation = useMutation({
    mutationFn: () => ytScraperApi.refreshAccountInfo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
  });

  useEffect(() => {
    if (isLoggedIn && !statusData?.channelName && !statusData?.email && !statusLoading) {
      refreshAccountInfoMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, statusLoading]);

  // Change account (reset session + re-open login)
  const changeAccountMutation = useMutation({
    mutationFn: async () => {
      await ytScraperApi.resetSession();
      const res = await ytScraperApi.openLogin();
      return res;
    },
    onSuccess: (res) => {
      const url = (res.data?.data as any)?.vncUrl as string | undefined;
      const vncLink = url || 'http://46.62.170.132:6080/vnc.html';
      toastSuccess('ytScraperChangeAccount', t('ytScraper.changeAccountSuccess'));
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      setWaitingForLogin(true);
      notification.open({
        key: 'vnc-login',
        message: t('ytScraper.vncBrowserOpened'),
        description: t('ytScraper.vncLoginDescAuto'),
        duration: 0,
        btn: (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => { window.open(vncLink, '_blank', 'noopener,noreferrer'); notification.destroy('vnc-login'); }}
          >
            {t('ytScraper.openLoginPage')}
          </Button>
        ),
      });
    },
    onError: () => {
      toastError('ytScraperChangeError', t('ytScraper.resetSessionError'));
      setWaitingForLogin(false);
    },
  });

  // Cookie import modal state
  const [cookieModalOpen, setCookieModalOpen] = React.useState(false);
  const [cookieText, setCookieText] = React.useState('');

  const importCookiesMutation = useMutation({
    mutationFn: (cookies: Array<Record<string, unknown>>) => ytScraperApi.importCookies(cookies),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.loggedIn) {
        setCookieModalOpen(false);
        setCookieText('');
        setWaitingForLogin(false);
        setLoginBrowserOpen(false);
        toastSuccess('ytCookieImport', t('ytScraper.importCookiesSuccess'));
      } else {
        toastError('ytCookieImportFail', t('ytScraper.importCookiesFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: () => {
      toastError('ytCookieImportErr', t('ytScraper.importCookiesFailed'));
    },
  });

  const handleImportCookies = () => {
    try {
      const parsed = JSON.parse(cookieText.trim());
      const cookies = Array.isArray(parsed) ? parsed : [parsed];
      if (cookies.length === 0) {
        toastError('ytCookieEmpty', t('ytScraper.importCookiesEmpty'));
        return;
      }
      importCookiesMutation.mutate(cookies);
    } catch {
      toastError('ytCookieParseErr', t('ytScraper.importCookiesInvalidJson'));
    }
  };

  // Verify session (close login browser + headless Playwright check)
  const verifySessionMutation = useMutation({
    mutationFn: () => ytScraperApi.verifySession(),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.loggedIn) {
        setWaitingForLogin(false);
        setLoginBrowserOpen(false);
        notification.destroy('vnc-login');
        toastSuccess('ytLoginSuccess', t('ytScraper.loginSuccess'));
      } else {
        toastError('ytVerifyFailed', t('ytScraper.verifyFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: () => {
      toastError('ytVerifyError', t('ytScraper.verifyFailed'));
    },
  });

  return (
    <Spin spinning={isLoading} tip={loadingTip} size="large" className="stats-page-spin">
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          {t('menu.cronSettings')}
        </Title>
        <Space>
          <Button icon={<ClockCircleOutlined />} onClick={() => refetchConfig()}>
            {t('common.reload')}
          </Button>
          <Popconfirm
            title={t('cron.confirmRunNow')}
            description={
              preview?.canRun === false
                ? t('cron.cannotRunReason', { month: preview?.targetMonth || '...' })
                : t('cron.confirmRunNowDesc', { month: preview?.targetMonth || '...' })
            }
            onConfirm={() => runNowMutation.mutate()}
            okText={t('common.yes')}
            cancelText={t('common.no')}
            disabled={preview?.canRun === false}
          >
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={runNowMutation.isPending}
              danger
              disabled={preview?.canRun === false}
              title={preview?.canRun === false ? t('cron.monthNotCompleted') : ''}
            >
              {t('cron.runNow')}
            </Button>
          </Popconfirm>
          {isLoggedIn ? (
            <Popconfirm
              title={t('ytScraper.changeAccount')}
              description={t('ytScraper.changeAccountConfirm')}
              onConfirm={() => changeAccountMutation.mutate()}
              okText={t('common.yes')}
              cancelText={t('common.no')}
              okButtonProps={{ danger: true }}
            >
              <Tooltip
                title={
                  <div style={{ lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('ytScraper.connected')}</div>
                    {refreshAccountInfoMutation.isPending ? (
                      <div><LoadingOutlined style={{ marginRight: 6 }} />{t('ytScraper.loadingAccountInfo')}</div>
                    ) : (
                      <>
                        {statusData?.channelName && (
                          <div><YoutubeOutlined style={{ marginRight: 6, color: '#ff4d4f' }} />{statusData.channelName}</div>
                        )}
                        {statusData?.email && (
                          <div><UserOutlined style={{ marginRight: 6, color: '#69b1ff' }} />{statusData.email}</div>
                        )}
                        {!statusData?.channelName && !statusData?.email && (
                          <div style={{ color: '#aaa', fontSize: 12 }}>{t('ytScraper.noAccountInfo')}</div>
                        )}
                      </>
                    )}
                  </div>
                }
                color="#1d1d1d"
                placement="bottomRight"
              >
                <Button
                  icon={<SwapOutlined />}
                  loading={changeAccountMutation.isPending}
                  style={{ borderColor: '#52c41a', color: '#52c41a' }}
                >
                  {t('ytScraper.changeAccount')}
                </Button>
              </Tooltip>
            </Popconfirm>
          ) : loginBrowserOpen ? (
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={verifySessionMutation.isPending}
                onClick={() => verifySessionMutation.mutate()}
              >
                {t('ytScraper.verifyLogin')}
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => window.open('http://46.62.170.132:6080/vnc.html', '_blank', 'noopener,noreferrer')}
              >
                {t('ytScraper.openLoginPage')}
              </Button>
            </Space>
          ) : (
            <Space>
              <Button
                type="primary"
                icon={<SwapOutlined />}
                loading={changeAccountMutation.isPending}
                onClick={() => changeAccountMutation.mutate()}
              >
                {t('ytScraper.connect')}
              </Button>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setCookieModalOpen(true)}
              >
                {t('ytScraper.importCookies')}
              </Button>
            </Space>
          )}
        </Space>
      </div>

      <SummaryBar
        items={[
          {
            title: t('cron.schedulerStatus'),
            value: config?.schedulerRunning ? t('cron.running') : t('cron.stopped'),
            valueStyle: { color: config?.schedulerRunning ? '#52c41a' : '#ff4d4f' },
          },
          {
            title: t('cron.cronEnabled'),
            value: config?.enabled ? t('common.yes') : t('common.no'),
            valueStyle: { color: config?.enabled ? '#52c41a' : '#ff4d4f' },
          },
          {
            title: t('cron.nextCycleMonth'),
            value: preview?.targetMonth || '-',
            valueStyle: { color: '#1677ff' },
          },
          {
            title: t('cron.totalRuns'),
            value: runHistory.length,
            valueStyle: { color: '#722ed1' },
          },
        ]}
        loading={configLoading}
      />

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <CronConfigCard
            form={form}
            configLoading={configLoading}
            day={day}
            hour={hour}
            minute={minute}
            updateLoading={updateMutation.isPending}
            onDayChange={setDay}
            onHourChange={setHour}
            onMinuteChange={setMinute}
            onEnabledChange={handleEnabledChange}
            onAutoCreateCycleChange={handleAutoCreateCycleChange}
            onAutoScrapeRevenueChange={handleAutoScrapeRevenueChange}
            onSave={handleSave}
          />
        </Col>
        <Col xs={24} lg={12}>
          <CronStatusCard config={config} preview={preview} />
        </Col>
      </Row>

      <RunHistoryTable runHistory={runHistory} />

      {/* Cookie Import Modal */}
      <Modal
        title={t('ytScraper.importCookies')}
        open={cookieModalOpen}
        onCancel={() => { setCookieModalOpen(false); setCookieText(''); }}
        onOk={handleImportCookies}
        okText={t('ytScraper.importCookiesSubmit')}
        okButtonProps={{ loading: importCookiesMutation.isPending, disabled: !cookieText.trim() }}
        cancelText={t('common.cancel')}
        width={640}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            <strong>{t('ytScraper.importCookiesDesc')}</strong>
          </Typography.Paragraph>
          <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>{t('ytScraper.importCookiesStep1')}</li>
            <li>{t('ytScraper.importCookiesStep2')}</li>
            <li>{t('ytScraper.importCookiesStep3')}</li>
            <li>{t('ytScraper.importCookiesStep4')}</li>
          </ol>
        </div>
        <Input.TextArea
          rows={10}
          placeholder='[{"name": "SID", "value": "...", "domain": ".youtube.com", ...}]'
          value={cookieText}
          onChange={(e) => setCookieText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </div>
    </Spin>
  );
};

export default CronSettingsPage;
