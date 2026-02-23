import { Card, Spin, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const { Title, Text } = Typography;

/** Format large numbers: 6900000 → "6.9M", 31600 → "31.6K" */
const formatNumber = (val: number | null | undefined): string => {
  if (val == null || val === 0) return '-';
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return val.toLocaleString();
};

interface Top10ChartProps {
  topKOCs: any[];
  loading: boolean;
}

const Top10Chart: React.FC<Top10ChartProps> = ({ topKOCs, loading }) => {
  const { t } = useTranslation();

  return (
    <Card style={{ marginBottom: 16 }}>
      <Title level={4}>{t('stats.top10ChannelsByViews')}</Title>
      <Spin spinning={loading}>
        {topKOCs.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topKOCs}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel_name" height={60} />
              <YAxis tickFormatter={(val) => formatNumber(val)} />
              <RechartsTooltip formatter={(val) => formatNumber(Number(val))} />
              <Legend />
              <Bar dataKey="views_28d_num" fill="#8884d8" name={t('stats.views')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Text>{t('common.noData')}</Text>
        )}
      </Spin>
    </Card>
  );
};

export default Top10Chart;
