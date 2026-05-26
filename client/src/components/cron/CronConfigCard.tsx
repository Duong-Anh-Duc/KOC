import { CalendarOutlined, ClockCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Divider, Form, Row, Space, Switch, Typography } from 'antd';
import { AppSpin, NativeSelect } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface CronConfigCardProps {
  form: any;
  configLoading: boolean;
  day: number;
  hour: number;
  minute: number;
  updateLoading: boolean;
  onDayChange: (val: number) => void;
  onHourChange: (val: number) => void;
  onMinuteChange: (val: number) => void;
  onEnabledChange: (checked: boolean) => void;
  onAutoCreateCycleChange: (checked: boolean) => void;
  onAutoScrapeRevenueChange: (checked: boolean) => void;
  onSave: () => void;
}

const CronConfigCard: React.FC<CronConfigCardProps> = ({
  form,
  configLoading,
  day,
  hour,
  minute,
  updateLoading,
  onDayChange,
  onHourChange,
  onMinuteChange,
  onEnabledChange,
  onAutoCreateCycleChange,
  onAutoScrapeRevenueChange,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          {t('cron.configTitle')}
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <AppSpin spinning={configLoading}>
        <Form form={form} layout="vertical">
          <Form.Item name="enabled" label={t('cron.enableCron')} valuePropName="checked">
            <Switch
              checkedChildren={t('cron.enabled')}
              unCheckedChildren={t('cron.disabled')}
              onChange={onEnabledChange}
              loading={updateLoading}
            />
          </Form.Item>

          <Divider />

          <Form.Item label={t('cron.scheduleSettings')}>
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  {t('cron.dayOfMonth')}
                </Text>
                {/* AntD-original: <Select value={day} ... /> */}
                <NativeSelect
                  value={day}
                  onChange={(v) => onDayChange(Number(v))}
                  style={{ width: '100%' }}
                  options={Array.from({ length: 31 }, (_, i) => ({
                    value: i + 1,
                    label: `${t('cron.day')} ${i + 1}`,
                  }))}
                />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {t('cron.hour')}
                </Text>
                {/* AntD-original: <Select value={hour} ... /> */}
                <NativeSelect
                  value={hour}
                  onChange={(v) => onHourChange(Number(v))}
                  style={{ width: '100%' }}
                  options={Array.from({ length: 24 }, (_, i) => ({
                    value: i,
                    label: `${String(i).padStart(2, '0')}:00`,
                  }))}
                />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {t('cron.minute')}
                </Text>
                {/* AntD-original: <Select value={minute} ... /> */}
                <NativeSelect
                  value={minute}
                  onChange={(v) => onMinuteChange(Number(v))}
                  style={{ width: '100%' }}
                  options={Array.from({ length: 60 }, (_, i) => ({
                    value: i,
                    label: String(i).padStart(2, '0'),
                  }))}
                />
              </Col>
            </Row>
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message={
              <Text strong>
                {t('cron.schedulePreviewResult', {
                  day,
                  time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                })}
              </Text>
            }
            style={{ marginBottom: 16 }}
          />

          <Divider />

          <Form.Item
            name="autoCreateCycle"
            label={t('cron.autoCreateCycle')}
            valuePropName="checked"
            extra={t('cron.autoCreateCycleDesc')}
          >
            <Switch onChange={onAutoCreateCycleChange} loading={updateLoading} />
          </Form.Item>

          <Form.Item
            name="autoScrapeRevenue"
            label={t('cron.autoScrapeRevenue')}
            valuePropName="checked"
            extra={t('cron.autoScrapeRevenueDesc')}
          >
            <Switch onChange={onAutoScrapeRevenueChange} loading={updateLoading} />
          </Form.Item>

          <Button type="primary" onClick={onSave} loading={updateLoading} block>
            {t('common.save')}
          </Button>
        </Form>
      </AppSpin>
    </Card>
  );
};

export default CronConfigCard;
