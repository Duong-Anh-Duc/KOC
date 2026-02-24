import { ReloadOutlined } from '@ant-design/icons';
import { Button, DatePicker, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface AuditLogsHeaderProps {
  dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  onDateRangeChange: (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
  entityFilter: string | undefined;
  onEntityFilterChange: (value: string | undefined) => void;
  actionFilter: string | undefined;
  onActionFilterChange: (value: string | undefined) => void;
  onRefresh: () => void;
}

const AuditLogsHeader: React.FC<AuditLogsHeaderProps> = ({
  dateRange,
  onDateRangeChange,
  entityFilter,
  onEntityFilterChange,
  actionFilter,
  onActionFilterChange,
  onRefresh,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Title level={3} style={{ margin: 0 }}>{t('menu.audit')}</Title>
      <Space wrap>
        <RangePicker
          format="DD/MM/YYYY"
          placeholder={[t('common.startDate'), t('common.endDate')]}
          value={dateRange}
          onChange={onDateRangeChange}
          presets={[
            { label: t('common.last7Days'), value: [dayjs().subtract(7, 'day'), dayjs()] },
            { label: t('common.last30Days'), value: [dayjs().subtract(30, 'day'), dayjs()] },
            { label: t('common.thisMonth'), value: [dayjs().startOf('month'), dayjs().endOf('month')] },
            { label: t('common.lastMonth'), value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
          ]}
          allowClear
        />
        <Select
          style={{ width: 180 }}
          placeholder={t('audit.filterEntity')}
          allowClear
          value={entityFilter}
          onChange={onEntityFilterChange}
          options={[
            { value: 'KOC', label: t('audit.entities.KOC') },
            { value: 'REVENUE_RECORD', label: t('audit.entities.REVENUE_RECORD') },
            { value: 'REVENUE_CYCLE', label: t('audit.entities.REVENUE_CYCLE') },
            { value: 'USER', label: t('audit.entities.USER') },
            { value: 'CHANNEL_STAT', label: t('audit.entities.CHANNEL_STAT') },
            { value: 'SYSTEM_CONFIG', label: t('audit.entities.SYSTEM_CONFIG') },
          ]}
        />
        <Select
          style={{ width: 220 }}
          placeholder={t('audit.filterAction')}
          allowClear
          value={actionFilter}
          onChange={onActionFilterChange}
          options={[
            { value: 'CREATE_KOC', label: t('audit.actions.CREATE_KOC') },
            { value: 'UPDATE_KOC', label: t('audit.actions.UPDATE_KOC') },
            { value: 'DELETE_KOC', label: t('audit.actions.DELETE_KOC') },
            { value: 'CREATE_REVENUE_RECORD', label: t('audit.actions.CREATE_REVENUE_RECORD') },
            { value: 'UPDATE_REVENUE_RECORD', label: t('audit.actions.UPDATE_REVENUE_RECORD') },
            { value: 'DELETE_REVENUE_RECORD', label: t('audit.actions.DELETE_REVENUE_RECORD') },
            { value: 'APPROVE_REVENUE_RECORD', label: t('audit.actions.APPROVE_REVENUE_RECORD') },
            { value: 'CREATE_CYCLE', label: t('audit.actions.CREATE_CYCLE') },
            { value: 'UPDATE_CYCLE', label: t('audit.actions.UPDATE_CYCLE') },
            { value: 'LOCK_CYCLE', label: t('audit.actions.LOCK_CYCLE') },
            { value: 'COMPLETE_CYCLE', label: t('audit.actions.COMPLETE_CYCLE') },
            { value: 'SCRAPE_REVENUE', label: t('audit.actions.SCRAPE_REVENUE') },
            { value: 'RUN_CRON_JOB', label: t('audit.actions.RUN_CRON_JOB') },
            { value: 'UPDATE_CRON_CONFIG', label: t('audit.actions.UPDATE_CRON_CONFIG') },
            { value: 'UPDATE_EMAIL_CONFIG', label: t('audit.actions.UPDATE_EMAIL_CONFIG') },
            { value: 'SEND_REVENUE_EMAILS', label: t('audit.actions.SEND_REVENUE_EMAILS') },
            { value: 'LOGIN', label: t('audit.actions.LOGIN') },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
      </Space>
    </div>
  );
};

export default AuditLogsHeader;
