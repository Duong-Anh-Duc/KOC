import {
    BarChartOutlined,
    CloudSyncOutlined,
    DollarOutlined,
    EyeOutlined,
    FieldTimeOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ytScraperApi } from '../../api/endpoints';
import type { MonthlyRevenueAnalytics } from '../../types';
import { formatUSD, getTableLocale } from '../../utils';

const { Text } = Typography;

interface MonthlyRevenueModalProps {
  open: boolean;
  onClose: () => void;
  kocId: string | null;
  kocName?: string;
  channelName?: string;
}

const MonthlyRevenueModal: React.FC<MonthlyRevenueModalProps> = ({
  open,
  onClose,
  kocId,
  kocName,
  channelName,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch stored monthly data
  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ['monthlyRevenue', kocId],
    queryFn: async () => {
      if (!kocId) return [];
      const res = await ytScraperApi.getMonthlyRevenue(kocId);
      return res.data.data || [];
    },
    enabled: !!kocId && open,
  });

  // Scrape monthly data mutation
  const scrapeMutation = useMutation({
    mutationFn: async () => {
      if (!kocId) throw new Error('No KOC ID');
      return ytScraperApi.scrapeMonthlyRevenue(kocId);
    },
    onSuccess: (res) => {
      const monthCount = res.data.data?.monthCount || 0;
      message.success(t('ytScraper.scrapeMonthlySuccess', { count: monthCount }));
      queryClient.invalidateQueries({ queryKey: ['monthlyRevenue', kocId] });
    },
    onError: () => {
      message.error(t('ytScraper.scrapeMonthlyError'));
    },
  });

  // Calculate totals from data
  const totals = React.useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return null;
    return {
      views: monthlyData.reduce((sum, r) => sum + (r.views || 0), 0),
      watchTimeHours: monthlyData.reduce((sum, r) => sum + (r.watch_time_hours || 0), 0),
      estimatedRevenue: monthlyData.reduce((sum, r) => sum + (r.estimated_revenue || 0), 0),
    };
  }, [monthlyData]);

  const columns: ColumnsType<MonthlyRevenueAnalytics> = [
    {
      title: t('ytScraper.monthKey'),
      dataIndex: 'month_key',
      key: 'month_key',
      width: 100,
      fixed: 'left',
      render: (val: string, record) => (
        <Text strong>
          {val}
          {(record.month_label?.includes('đang diễn ra') || record.month_label?.includes('current')) && (
            <Tag color="processing" style={{ marginLeft: 4, fontSize: 10 }}>{t('ytScraper.currentMonthTag')}</Tag>
          )}
        </Text>
      ),
    },
    {
      title: t('ytScraper.estimatedRevenue'),
      dataIndex: 'estimated_revenue',
      key: 'estimated_revenue',
      width: 150,
      align: 'right',
      sorter: (a, b) => (a.estimated_revenue || 0) - (b.estimated_revenue || 0),
      render: (val: number | null, record) => val != null ? (
        <span>
          <Text strong style={{ color: '#52c41a' }}>{formatUSD(val)}</Text>
          {record.revenue_percent != null && (
            <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
              ({record.revenue_percent}%)
            </Text>
          )}
        </span>
      ) : '–',
    },
    {
      title: t('ytScraper.views'),
      dataIndex: 'views',
      key: 'views',
      width: 140,
      align: 'right',
      sorter: (a, b) => (a.views || 0) - (b.views || 0),
      render: (val: number | null, record) => val != null ? (
        <span>
          {Number(val).toLocaleString()}
          {record.views_percent != null && (
            <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
              ({record.views_percent}%)
            </Text>
          )}
        </span>
      ) : '–',
    },
    {
      title: t('ytScraper.watchTime'),
      dataIndex: 'watch_time_hours',
      key: 'watch_time_hours',
      width: 150,
      align: 'right',
      sorter: (a, b) => (a.watch_time_hours || 0) - (b.watch_time_hours || 0),
      render: (val: number | null, record) => val != null ? (
        <span>
          {Number(val).toLocaleString()} {t('ytScraper.hours')}
          {record.watch_time_percent != null && (
            <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
              ({record.watch_time_percent}%)
            </Text>
          )}
        </span>
      ) : '–',
    },
    {
      title: t('ytScraper.avgWatchTime'),
      dataIndex: 'avg_watch_time',
      key: 'avg_watch_time',
      width: 120,
      align: 'right',
      render: (val: string | null) => val || '–',
    },
    {
      title: t('ytScraper.scrapedAt'),
      dataIndex: 'scraped_at',
      key: 'scraped_at',
      width: 140,
      render: (val: string) => val ? dayjs(val).format('DD/MM/YY HH:mm') : '–',
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <BarChartOutlined style={{ color: '#ED8F3A' }} />
          <span>{t('ytScraper.monthlyAnalytics')}</span>
          {kocName && (
            <>
              <span style={{ fontSize: 13, fontWeight: 'normal', color: '#666' }}>{t('ytScraper.creatorLabel')}:</span>
              <Tag color="blue">{kocName}</Tag>
            </>
          )}
          {channelName && (
            <>
              <span style={{ fontSize: 13, fontWeight: 'normal', color: '#666' }}>{t('ytScraper.channelLabel')}:</span>
              <Tag color="orange">{channelName}</Tag>
            </>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={950}
      destroyOnClose
      footer={
        <Space>
          <Button
            type="primary"
            icon={scrapeMutation.isPending ? <LoadingOutlined /> : <CloudSyncOutlined />}
            onClick={() => scrapeMutation.mutate()}
            loading={scrapeMutation.isPending}
          >
            {t('ytScraper.scrapeMonthly')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </Space>
      }
    >
      <Spin spinning={isLoading || scrapeMutation.isPending} tip={scrapeMutation.isPending ? t('ytScraper.scrapeMonthlyLoading') : undefined}>
        {/* Summary stats */}
        {totals && (
          <div style={{
            display: 'flex',
            gap: 24,
            marginBottom: 16,
            padding: '12px 16px',
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}>
            <div>
              <Text type="secondary"><DollarOutlined /> {t('ytScraper.totalLabel')} {t('ytScraper.estimatedRevenue')}</Text>
              <div><Text strong style={{ color: '#52c41a', fontSize: 18 }}>{formatUSD(totals.estimatedRevenue)}</Text></div>
            </div>
            <div>
              <Text type="secondary"><EyeOutlined /> {t('ytScraper.totalLabel')} {t('ytScraper.views')}</Text>
              <div><Text strong style={{ fontSize: 18 }}>{totals.views.toLocaleString()}</Text></div>
            </div>
            <div>
              <Text type="secondary"><FieldTimeOutlined /> {t('ytScraper.totalLabel')} {t('ytScraper.watchTime')}</Text>
              <div><Text strong style={{ fontSize: 18 }}>{totals.watchTimeHours.toLocaleString()} {t('ytScraper.hours')}</Text></div>
            </div>
            <div>
              <Text type="secondary">{t('ytScraper.monthlyData')}</Text>
              <div><Text strong style={{ fontSize: 18 }}>{monthlyData?.length || 0} {t('ytScraper.months')}</Text></div>
            </div>
          </div>
        )}

        <Table<MonthlyRevenueAnalytics>
          columns={columns}
          dataSource={monthlyData || []}
          rowKey="id"
          size="small"
          bordered
          loading={isLoading}
          locale={getTableLocale(t)}
          pagination={false}
          scroll={{ x: 800 }}
          summary={() =>
            totals ? (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>{t('ytScraper.totalLabel')}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ color: '#52c41a' }}>{formatUSD(totals.estimatedRevenue)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <strong>{totals.views.toLocaleString()}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong>{totals.watchTimeHours.toLocaleString()} {t('ytScraper.hours')}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </Spin>
    </Modal>
  );
};

export default MonthlyRevenueModal;
