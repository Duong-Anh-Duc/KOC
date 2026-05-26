import {
    ClockCircleOutlined,
    PlayCircleOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Col, Form, Popconfirm, Row, Space, Spin, Typography } from 'antd';
import { AppSpin, AppTooltip, SummaryBar } from '../components/common';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cronApi } from '../api';
import { CronConfigCard, CronStatusCard, RunHistoryTable } from '../components/cron';
import CookieImportModal from '../components/cron/CookieImportModal';
import { useYtScraperStatus } from '../hooks/useYtScraperStatus';
import { toastError, toastSuccess } from '../utils';

const { Title } = Typography;

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

  const getCronExpression = () => `${minute} ${hour} ${day} * *`;

  // YT Scraper status (for cookie import modal)
  const { cookieModalOpen, setCookieModalOpen, importCookiesMutation } = useYtScraperStatus();

  // Cron config
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
      updateMutation.mutate({ ...values, schedule: getCronExpression() });
    });
  };

  const handleToggle = (field: string, checked: boolean) => {
    form.setFieldValue(field, checked);
    updateMutation.mutate({
      enabled: field === 'enabled' ? checked : config?.enabled,
      schedule: getCronExpression(),
      autoCreateCycle: field === 'autoCreateCycle' ? checked : config?.autoCreateCycle,
      autoScrapeRevenue: field === 'autoScrapeRevenue' ? checked : config?.autoScrapeRevenue,
    });
  };

  const runHistory = config?.runHistory || [];

  return (
    <AppSpin spinning={runNowMutation.isPending} tip={t('cron.runningNow')} size="large" className="stats-page-spin">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
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
              onEnabledChange={(checked) => handleToggle('enabled', checked)}
              onAutoCreateCycleChange={(checked) => handleToggle('autoCreateCycle', checked)}
              onAutoScrapeRevenueChange={(checked) => handleToggle('autoScrapeRevenue', checked)}
              onSave={handleSave}
            />
          </Col>
          <Col xs={24} lg={12}>
            <CronStatusCard config={config} preview={preview} />
          </Col>
        </Row>

        <RunHistoryTable runHistory={runHistory} />

        <CookieImportModal
          open={cookieModalOpen}
          loading={importCookiesMutation.isPending}
          onCancel={() => setCookieModalOpen(false)}
          onImport={(cookies) => importCookiesMutation.mutate(cookies)}
        />
      </div>
    </AppSpin>
  );
};

export default CronSettingsPage;
