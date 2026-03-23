import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MonthlyRevenueAnalytics } from '../../types';

interface Props {
  data: MonthlyRevenueAnalytics[];
}

const MonthlyAnalyticsTable: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();

  const columns: ColumnsType<MonthlyRevenueAnalytics> = [
    {
      title: t('common.stt'),
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('ytScraper.monthKey'),
      dataIndex: 'month_label',
      key: 'month_label',
      width: 120,
    },
    {
      title: t('stats.views'),
      dataIndex: 'views',
      key: 'views',
      width: 120,
      align: 'right',
      render: (val: number | null) => val != null ? val.toLocaleString() : '-',
    },
    {
      title: t('stats.watchTime'),
      dataIndex: 'watch_time_hours',
      key: 'watch_time_hours',
      width: 120,
      align: 'right',
      render: (val: number | null) => val != null ? val.toLocaleString() : '-',
    },
    {
      title: t('stats.revenue'),
      dataIndex: 'estimated_revenue',
      key: 'estimated_revenue',
      width: 130,
      align: 'right',
      render: (val: number | null) =>
        val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-',
    },
  ];

  return (
    <Table<MonthlyRevenueAnalytics>
      columns={columns}
      dataSource={data}
      rowKey="id"
      bordered
      pagination={false}
      scroll={{ x: 600 }}
      size="middle"
    />
  );
};

export default MonthlyAnalyticsTable;
