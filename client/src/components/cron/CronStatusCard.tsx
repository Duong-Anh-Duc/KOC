import { ClockCircleOutlined } from '@ant-design/icons';
import { Alert, Badge, Card, Descriptions, Divider, Space, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Paragraph } = Typography;

/**
 * Convert cron expression to human-readable text
 */
const cronToHumanReadable = (
  cronExpr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string => {
  if (!cronExpr) return '-';
  const parts = cronExpr.split(' ');
  if (parts.length < 5) return cronExpr;
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 0;
  const day = parseInt(parts[2]) || 1;
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return t('cron.humanReadableSchedule', { day, time });
};

interface CronStatusCardProps {
  config: any;
  preview: any;
}

const CronStatusCard: React.FC<CronStatusCardProps> = ({ config, preview }) => {
  const { t } = useTranslation();

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined />
          {t('cron.statusTitle')}
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label={t('cron.schedulerStatus')}>
          <Badge
            status={config?.schedulerRunning ? 'processing' : 'default'}
            text={config?.schedulerRunning ? t('cron.running') : t('cron.stopped')}
          />
        </Descriptions.Item>
        <Descriptions.Item label={t('cron.currentSchedule')}>
          <Tag color="blue" style={{ fontSize: 13 }}>
            {config?.schedule ? cronToHumanReadable(config.schedule, t) : '-'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('cron.nextCycleMonth')}>
          <Space>
            <Tag color="blue">{preview?.targetMonth || '-'}</Tag>
            {preview?.canRun === false && (
              <Tag color="orange">{t('cron.monthNotCompleted')}</Tag>
            )}
            {preview?.canRun === true && (
              <Tag color="green">{t('cron.readyToRun')}</Tag>
            )}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label={t('cron.lastRunAt')}>
          {config?.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : t('cron.neverRun')}
        </Descriptions.Item>
        <Descriptions.Item label={t('cron.lastRunResult')}>
          {config?.lastRunResult ? (
            <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0, maxWidth: 300 }}>
              {config.lastRunResult}
            </Paragraph>
          ) : (
            '-'
          )}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {preview?.canRun === false && (
        <Alert
          type="warning"
          showIcon
          message={t('cron.cannotRunTitle')}
          description={t('cron.cannotRunReason', { month: preview?.targetMonth || '' })}
          style={{ marginBottom: 16 }}
        />
      )}

      <Alert
        type="info"
        showIcon
        message={t('cron.howItWorks')}
        description={
          <ol style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            <li>{t('cron.step1')}</li>
            <li>{t('cron.step2')}</li>
            <li>{t('cron.step3')}</li>
            <li>{t('cron.step4')}</li>
          </ol>
        }
      />
    </Card>
  );
};

export default CronStatusCard;
