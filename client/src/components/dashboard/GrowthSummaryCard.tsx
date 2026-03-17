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
      render: (val: string) => <Text strong style={{ fontSize: 13 }}>{val}</Text>,
    },
    {
      title: t('stats.viewsGrowth'),
      dataIndex: 'views_growth',
      width: 110,
      align: 'center' as const,
      render: (val: number) => (
        <Tag
          color={val >= 0 ? 'green' : 'red'}
          icon={val >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          style={{ margin: 0 }}
        >
          {val >= 0 ? '+' : ''}
          {val.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: t('stats.viewsDiff'),
      dataIndex: 'views_diff',
      width: 120,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 13 }}>
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
        <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 13 }}>
          {val >= 0 ? '+' : ''}
          {Number(val).toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Card
      style={{ height: '100%', borderRadius: 12, border: '2px solid #1677ff' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EyeOutlined />
          <span>{t('dashboard.growthOverview')}</span>
        </div>
      }
      styles={{ body: { padding: growthSummary.length > 0 ? '0' : '24px' } }}
    >
      {growthSummary.length > 0 ? (
        <Table
          columns={growthColumns}
          dataSource={growthSummary}
          rowKey="koc_id"
          pagination={false}
          size="small"
          scroll={{ x: 460 }}
          style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>
          <UserAddOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }} />
          <br />
          <Text type="secondary">{t('dashboard.noGrowthData')}</Text>
        </div>
      )}
    </Card>
  );
};

export default GrowthSummaryCard;
