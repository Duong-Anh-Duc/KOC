import { ArrowDownOutlined, ArrowUpOutlined, EyeOutlined, UserAddOutlined } from '@ant-design/icons';
import { Card, Table, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface GrowthSummaryCardProps {
  growthSummary: any[];
}

const GrowthSummaryCard: React.FC<GrowthSummaryCardProps> = ({ growthSummary }) => {
  const { t } = useTranslation();

  const growthColumns = [
    {
      title: t('koc.channelName'),
      dataIndex: 'channel_name',
      width: 140,
      ellipsis: true,
    },
    {
      title: t('stats.viewsGrowth'),
      dataIndex: 'views_growth',
      width: 110,
      align: 'center' as const,
      render: (val: number) => (
        <Tag color={val >= 0 ? 'green' : 'red'} icon={val >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
          {val >= 0 ? '+' : ''}
          {val.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: t('stats.viewsDiff'),
      dataIndex: 'views_diff',
      width: 110,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {val >= 0 ? '+' : ''}
          {Number(val).toLocaleString()}
        </Text>
      ),
    },
    {
      title: t('stats.subsDiff'),
      dataIndex: 'subs_diff',
      width: 100,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {val >= 0 ? '+' : ''}
          {Number(val).toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Card
      style={{ height: '100%' }}
      title={
        <span>
          <EyeOutlined style={{ marginRight: 8 }} />
          {t('dashboard.growthOverview')}
        </span>
      }
    >
      {growthSummary.length > 0 ? (
        <Table columns={growthColumns} dataSource={growthSummary} rowKey="koc_id" pagination={false} size="small" scroll={{ x: 460 }} />
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
          <UserAddOutlined style={{ fontSize: 24, marginBottom: 8 }} />
          <br />
          {t('dashboard.noGrowthData')}
        </div>
      )}
    </Card>
  );
};

export default GrowthSummaryCard;
