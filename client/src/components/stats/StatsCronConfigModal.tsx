import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Col, Modal, Row, Select, Space, Spin, Switch, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statsApi } from '../../api';
import { toastError, toastSuccess } from '../../utils';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

const parseCron = (expr: string) => {
  const parts = expr.split(' ');
  return {
    minute: parseInt(parts[0]) || 0,
    hour: parseInt(parts[1]) || 0,
    dayOfWeek: parts[4] === '*' ? '*' : parts[4],
    dayOfMonth: parts[2] === '*' ? '*' : parts[2],
  };
};

const StatsCronConfigModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(2);
  const [minute, setMinute] = useState(0);

  const { data: configData, isLoading } = useQuery({
    queryKey: ['stats-cron-config'],
    queryFn: async () => {
      const res = await statsApi.getCronConfig();
      return res.data?.data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (configData) {
      setEnabled(configData.enabled);
      const parsed = parseCron(configData.schedule || '0 2 * * 1');
      setMinute(parsed.minute);
      setHour(parsed.hour);
      if (parsed.dayOfMonth !== '*') {
        setFrequency('monthly');
        setDayOfMonth(parseInt(parsed.dayOfMonth));
      } else if (parsed.dayOfWeek !== '*') {
        setFrequency('weekly');
        setDayOfWeek(parseInt(parsed.dayOfWeek as string));
      } else {
        setFrequency('daily');
      }
    }
  }, [configData]);

  const buildCronExpr = () => {
    if (frequency === 'daily') return `${minute} ${hour} * * *`;
    if (frequency === 'weekly') return `${minute} ${hour} * * ${dayOfWeek}`;
    return `${minute} ${hour} ${dayOfMonth} * *`;
  };

  const updateMutation = useMutation({
    mutationFn: (data: { enabled?: boolean; schedule?: string }) =>
      statsApi.updateCronConfig(data),
    onSuccess: () => {
      toastSuccess('statsCronUpdated', t('stats.cronConfigSaved'));
      queryClient.invalidateQueries({ queryKey: ['stats-cron-config'] });
    },
    onError: () => {
      toastError('statsCronError', t('stats.cronConfigError'));
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ enabled, schedule: buildCronExpr() });
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    updateMutation.mutate({ enabled: checked, schedule: buildCronExpr() });
  };

  const weekDays = [
    { value: 0, label: t('stats.sunday') },
    { value: 1, label: t('stats.monday') },
    { value: 2, label: t('stats.tuesday') },
    { value: 3, label: t('stats.wednesday') },
    { value: 4, label: t('stats.thursday') },
    { value: 5, label: t('stats.friday') },
    { value: 6, label: t('stats.saturday') },
  ];

  const getSchedulePreview = () => {
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (frequency === 'daily') return t('stats.cronPreviewDaily', { time: timeStr });
    if (frequency === 'weekly') {
      const dayName = weekDays.find(d => d.value === dayOfWeek)?.label || '';
      return t('stats.cronPreviewWeekly', { day: dayName, time: timeStr });
    }
    return t('stats.cronPreviewMonthly', { day: dayOfMonth, time: timeStr });
  };

  return (
    <Modal
      title={t('stats.cronConfigTitle')}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={updateMutation.isPending}
      width="min(520px, 100vw - 32px)"
    >
      <Spin spinning={isLoading}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>{t('stats.cronEnable')}</Text>
            <Switch
              checked={enabled}
              onChange={handleToggle}
              loading={updateMutation.isPending}
              checkedChildren={t('cron.enabled')}
              unCheckedChildren={t('cron.disabled')}
            />
          </Space>
          {configData?.schedulerRunning && (
            <Text type="success" style={{ marginLeft: 12 }}>{t('cron.running')}</Text>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            {t('stats.cronFrequency')}
          </Text>
          <Select
            value={frequency}
            onChange={setFrequency}
            style={{ width: '100%' }}
            options={[
              { value: 'daily', label: t('stats.cronDaily') },
              { value: 'weekly', label: t('stats.cronWeekly') },
              { value: 'monthly', label: t('stats.cronMonthly') },
            ]}
          />
        </div>

        {frequency === 'weekly' && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {t('stats.cronDayOfWeek')}
            </Text>
            <Select
              value={dayOfWeek}
              onChange={setDayOfWeek}
              style={{ width: '100%' }}
              options={weekDays}
            />
          </div>
        )}

        {frequency === 'monthly' && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {t('cron.dayOfMonth')}
            </Text>
            <Select
              value={dayOfMonth}
              onChange={setDayOfMonth}
              style={{ width: '100%' }}
              options={Array.from({ length: 31 }, (_, i) => ({
                value: i + 1,
                label: `${t('cron.day')} ${i + 1}`,
              }))}
            />
          </div>
        )}

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {t('cron.hour')}
            </Text>
            <Select
              value={hour}
              onChange={setHour}
              style={{ width: '100%' }}
              options={Array.from({ length: 24 }, (_, i) => ({
                value: i,
                label: `${String(i).padStart(2, '0')}:00`,
              }))}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {t('cron.minute')}
            </Text>
            <Select
              value={minute}
              onChange={setMinute}
              style={{ width: '100%' }}
              options={Array.from({ length: 60 }, (_, i) => ({
                value: i,
                label: String(i).padStart(2, '0'),
              }))}
            />
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          message={getSchedulePreview()}
          style={{ marginBottom: 12 }}
        />

        {configData?.lastRunAt && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('stats.cronLastRun')}: {new Date(configData.lastRunAt).toLocaleString()}
            {configData.lastRunResult && ` — ${configData.lastRunResult}`}
          </Text>
        )}
      </Spin>
    </Modal>
  );
};

export default StatsCronConfigModal;
