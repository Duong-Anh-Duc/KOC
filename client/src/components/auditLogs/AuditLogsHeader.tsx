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
  onRefresh: () => void;
}

const AuditLogsHeader: React.FC<AuditLogsHeaderProps> = ({
  dateRange,
  onDateRangeChange,
  entityFilter,
  onEntityFilterChange,
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
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
      </Space>
    </div>
  );
};

export default AuditLogsHeader;
