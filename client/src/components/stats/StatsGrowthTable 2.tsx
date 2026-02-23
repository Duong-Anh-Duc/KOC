import { EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Card, Table, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getTableLocale } from '../../utils';

const { Title, Text } = Typography;

/** Display raw Vietnamese string or dash for null */
const displayRaw = (val: string | null | undefined): string => {
  if (val == null || val === '') return '-';
  return val;
};

interface StatsGrowthTableProps {
  growthList: any[];
  loading: boolean;
  onViewKOC: (kocId: string) => void;
}

const StatsGrowthTable: React.FC<StatsGrowthTableProps> = ({ growthList, loading, onViewKOC }) => {
  const { t } = useTranslation();

  const columns = [
    {
      title: t('koc.fullName'),
      dataIndex: 'full_name',
      width: 150,
      fixed: 'left' as const,
    },
    {
      title: t('koc.channelName'),
      dataIndex: 'channel_name',
      width: 140,
    },
    {
      title: t('stats.views'),
      dataIndex: 'views_28d',
      width: 120,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.views_28d_num || 0) - (b.views_28d_num || 0),
      render: (val: string | null) => <Text strong>{displayRaw(val)}</Text>,
    },
    {
      title: t('stats.watchTime'),
      dataIndex: 'watch_time_hours_28d',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.watch_time_hours_28d_num || 0) - (b.watch_time_hours_28d_num || 0),
      render: (val: string | null) => <Text>{displayRaw(val)}</Text>,
    },
    {
      title: t('stats.subscriptions'),
      dataIndex: 'subs_28d',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.subs_28d_num || 0) - (b.subs_28d_num || 0),
      render: (val: string | number | null) => (
        <Text strong style={{ color: val && !String(val).startsWith('-') ? '#52c41a' : undefined }}>
          {displayRaw(val != null ? String(val) : null)}
        </Text>
      ),
    },
    {
      title: t('stats.revenue'),
      dataIndex: 'estimated_revenue_28d',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.estimated_revenue_28d_num || 0) - (b.estimated_revenue_28d_num || 0),
      render: (val: string | null) => (
        <Text strong style={{ color: '#faad14' }}>
          {displayRaw(val)}
        </Text>
      ),
    },
    {
      title: t('stats.impressions'),
      dataIndex: 'impressions_28d',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.impressions_28d_num || 0) - (b.impressions_28d_num || 0),
      render: (val: string | null) => <Text>{displayRaw(val)}</Text>,
    },
    {
      title: t('stats.likes'),
      dataIndex: 'likes_28d',
      width: 100,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.likes_28d_num || 0) - (b.likes_28d_num || 0),
      render: (val: string | null) => <Text>{displayRaw(val)}</Text>,
    },
    {
      title: t('stats.audience'),
      dataIndex: 'monthly_viewers',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.monthly_viewers_num || 0) - (b.monthly_viewers_num || 0),
      render: (val: string | null) => <Text>{displayRaw(val)}</Text>,
    },
    {
      title: t('stats.lastRecorded'),
      dataIndex: 'last_recorded_at',
      width: 150,
      align: 'center' as const,
      render: (val: string, record: any) =>
        !record.has_data ? (
          <Tooltip title={t('stats.needMoreData')}>
            <Tag color="default">
              <InfoCircleOutlined /> {t('stats.noData')}
            </Tag>
          </Tooltip>
        ) : val ? (
          new Date(val).toLocaleString()
        ) : (
          '-'
        ),
    },
    {
      title: '',
      width: 60,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: unknown, record: any) => (
        <Tooltip title={record.has_data ? t('common.viewDetails') : t('stats.noData')}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined style={{ fontSize: 16, color: record.has_data ? '#1677ff' : '#d9d9d9' }} />}
            onClick={() => record.has_data && onViewKOC(record.koc_id)}
            disabled={!record.has_data}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Card style={{ marginBottom: 16 }}>
      <Title level={4}>{t('stats.growthTable')}</Title>
      <Table
        columns={columns}
        dataSource={growthList}
        rowKey="koc_id"
        loading={loading}
        bordered
        locale={getTableLocale(t)}
        pagination={{
          defaultPageSize: 15,
          pageSize: 15,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '15', '20', '30', '50'],
          showTotal: (total) => `${t('common.total')}: ${total}`,
        }}
        scroll={{ x: 1200 }}
      />
    </Card>
  );
};

export default StatsGrowthTable;
