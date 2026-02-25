import { EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Card, Table, Tag, Tooltip, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD, getTableLocale } from '../../utils';

const { Title, Text } = Typography;

/** Format large numbers: 6900000 → "6.9M", 31600 → "31.6K" */
const formatNumber = (val: number | null | undefined): string => {
  if (val == null || val === 0) return '-';
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return val.toLocaleString();
};

const formatDecimal = (val: number | null | undefined): string => {
  if (val == null || val === 0) return '-';
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

interface StatsGrowthTableProps {
  growthList: any[];
  loading: boolean;
  onViewKOC: (kocId: string) => void;
}

const StatsGrowthTable: React.FC<StatsGrowthTableProps> = ({ growthList, loading, onViewKOC }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageSize = 15;

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'right' as const,
      fixed: 'left' as const,
      render: (_: unknown, __: unknown, index: number) => (currentPage - 1) * currentPageSize + index + 1,
    },
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
      dataIndex: 'views_28d_num',
      width: 120,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.views_28d_num || 0) - (b.views_28d_num || 0),
      render: (val: number) => <Text strong>{formatNumber(val)}</Text>,
    },
    {
      title: t('stats.watchTime'),
      dataIndex: 'watch_time_hours_28d_num',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.watch_time_hours_28d_num || 0) - (b.watch_time_hours_28d_num || 0),
      render: (val: number) => <Text>{formatDecimal(val)}</Text>,
    },
    {
      title: t('stats.subsGained'),
      dataIndex: 'subs_gained_28d_num',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.subs_gained_28d_num || 0) - (b.subs_gained_28d_num || 0),
      render: (val: number) => (
        <Text strong style={{ color: val > 0 ? '#52c41a' : undefined }}>
          {val > 0 ? '+' : ''}{formatNumber(val)}
        </Text>
      ),
    },
    {
      title: t('stats.subsLost'),
      dataIndex: 'subs_lost_28d_num',
      width: 100,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.subs_lost_28d_num || 0) - (b.subs_lost_28d_num || 0),
      render: (val: number) => (
        <Text style={{ color: val > 0 ? '#ff4d4f' : undefined }}>
          {val > 0 ? '-' : ''}{formatNumber(val)}
        </Text>
      ),
    },
    {
      title: t('stats.revenue'),
      dataIndex: 'estimated_revenue_28d_num',
      width: 150,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.estimated_revenue_28d_num || 0) - (b.estimated_revenue_28d_num || 0),
      render: (val: number) => (
        <Text strong style={{ color: '#faad14' }}>
          {val ? formatUSD(val) : '-'}
        </Text>
      ),
    },
    {
      title: t('stats.likes'),
      dataIndex: 'likes_28d_num',
      width: 100,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.likes_28d_num || 0) - (b.likes_28d_num || 0),
      render: (val: number) => <Text>{formatNumber(val)}</Text>,
    },
    {
      title: t('stats.shares'),
      dataIndex: 'shares_28d_num',
      width: 100,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.shares_28d_num || 0) - (b.shares_28d_num || 0),
      render: (val: number) => <Text>{formatNumber(val)}</Text>,
    },
    {
      title: t('stats.lastRecorded'),
      dataIndex: 'last_recorded_at',
      width: 165,
      align: 'center' as const,
      render: (val: string, record: any) => {
        if (!record.has_data) {
          return (
            <Tooltip title={t('stats.needMoreData')}>
              <Tag color="default">
                <InfoCircleOutlined /> {t('stats.noData')}
              </Tag>
            </Tooltip>
          );
        }
        if (!val) return '-';
        // Format as dd/mm/yyyy hh:mm:ss
        const date = new Date(val);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      },
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
          current: currentPage,
          defaultPageSize: 15,
          pageSize: 15,
          showSizeChanger: false,
          showQuickJumper: true,
          pageSizeOptions: ['10', '15', '20', '30', '50'],
          showTotal: (total) => `${t('common.total')}: ${total}`,
          onChange: (p) => setCurrentPage(p),
        }}
        scroll={{ x: 1400 }}
      />
    </Card>
  );
};

export default StatsGrowthTable;
