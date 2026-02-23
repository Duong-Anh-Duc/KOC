import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, DatePicker, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;
const { RangePicker } = DatePicker;

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
