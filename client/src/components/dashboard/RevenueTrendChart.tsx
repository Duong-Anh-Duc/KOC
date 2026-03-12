import { Card } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatUSD } from '../../utils';

interface RevenueTrendChartProps {
  trendData: any[];
  loading: boolean;
  chartColors: { grid: string; text: string; tooltipBg: string; tooltipBorder: string };
}

const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({ trendData, loading, chartColors }) => {
  const { t } = useTranslation();

  const tooltipStyle = {
    backgroundColor: chartColors.tooltipBg,
    border: `1px solid ${chartColors.tooltipBorder}`,
    borderRadius: 8,
    color: chartColors.text,
  };

  return (
    <Card title={t('dashboard.revenueTrend')} loading={loading} style={{ borderRadius: 12 }}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={trendData || []}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis dataKey="month" stroke={chartColors.text} />
          <YAxis
            tickFormatter={(val) => (val ? `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}` : '$0')}
            stroke={chartColors.text}
          />
          <Tooltip formatter={(value: number | undefined) => (value != null ? formatUSD(value) : '$0')} contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="totalRevenue" name={t('dashboard.totalRevenue')} fill="#1677ff" radius={[8, 8, 0, 0]} />
          <Bar dataKey="totalKocPay" name={t('dashboard.kocPayUSD')} fill="#52c41a" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default RevenueTrendChart;
