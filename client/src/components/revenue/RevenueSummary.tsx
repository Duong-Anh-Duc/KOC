import { DollarOutlined, TeamOutlined } from '@ant-design/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueRecord } from '../../types';
import { formatUSD, formatVND } from '../../utils';
import { SummaryBar } from '../common';

interface RevenueSummaryProps {
  records: RevenueRecord[];
  totals: Record<string, number>;
  loading: boolean;
}

const RevenueSummary: React.FC<RevenueSummaryProps> = ({ records, totals, loading }) => {
  const { t } = useTranslation();

  return (
    <SummaryBar
      items={[
        {
          title: t('revenue.totalKOCs'),
          value: records.length,
          prefix: <TeamOutlined />,
          valueStyle: { color: '#1677ff' },
        },
        {
          title: t('revenue.originalRevenue'),
          value: totals.totalOriginal || 0,
          prefix: <DollarOutlined />,
          precision: 2,
          valueStyle: { color: '#fa8c16' },
          formatter: (val) => formatUSD(Number(val)),
        },
        {
          title: t('revenue.kocReceiveUsd'),
          value: totals.totalKocReceiveUsd || 0,
          precision: 2,
          valueStyle: { color: '#1677ff' },
          formatter: (val) => formatUSD(Number(val)),
        },
        {
          title: t('revenue.kocReceiveVnd'),
          value: totals.totalKocReceiveVnd || 0,
          precision: 0,
          valueStyle: { color: '#52c41a' },
          formatter: (val) => formatVND(Number(val)),
        },
      ]}
      loading={loading}
    />
  );
};

export default RevenueSummary;
