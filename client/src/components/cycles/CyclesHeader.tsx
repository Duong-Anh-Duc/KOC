import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

interface CyclesHeaderProps {
  dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  onDateRangeChange: (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
  onRefresh: () => void;
  isAdmin: boolean;
  onCreate: () => void;
}

const CyclesHeader: React.FC<CyclesHeaderProps> = ({
  dateRange,
  onDateRangeChange,
  onRefresh,
  isAdmin,
  onCreate,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Title level={3} style={{ margin: 0 }}>{t('menu.cycles')}</Title>
      <Space wrap>
        {/* AntD-original:
        <RangePicker
          format="DD/MM/YYYY"
          placeholder={[t('common.startDate'), t('common.endDate')]}
          value={dateRange}
          onChange={onDateRangeChange}
          presets={[
            { label: t('common.last30Days'), value: [dayjs().subtract(30, 'day'), dayjs()] },
            { label: t('common.last90Days'), value: [dayjs().subtract(90, 'day'), dayjs()] },
            { label: t('common.thisMonth'), value: [dayjs().startOf('month'), dayjs().endOf('month')] },
          ]}
          allowClear
        />
        */}
        <input
          type="date"
          className="native-bank-select"
          aria-label={t('common.startDate')}
          value={dateRange?.[0]?.format('YYYY-MM-DD') || ''}
          onChange={(e) => onDateRangeChange([
            e.target.value ? dayjs(e.target.value) : null,
            dateRange?.[1] || null,
          ])}
          style={{ width: 150 }}
        />
        <input
          type="date"
          className="native-bank-select"
          aria-label={t('common.endDate')}
          value={dateRange?.[1]?.format('YYYY-MM-DD') || ''}
          onChange={(e) => onDateRangeChange([
            dateRange?.[0] || null,
            e.target.value ? dayjs(e.target.value) : null,
          ])}
          style={{ width: 150 }}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {t('cycle.create')}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default CyclesHeader;
