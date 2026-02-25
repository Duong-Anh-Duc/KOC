import { HistoryOutlined } from '@ant-design/icons';
import { Drawer, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { YouTubeScrapeResult } from '../../types';
import { formatUSD, getTableLocale } from '../../utils';

const { Text } = Typography;

interface ScrapeHistoryDrawerProps {
  selectedKocId: string | null;
  kocHistory: YouTubeScrapeResult[] | undefined;
  historyLoading: boolean;
  onClose: () => void;
}

const ScrapeHistoryDrawer: React.FC<ScrapeHistoryDrawerProps> = ({
  selectedKocId,
  kocHistory,
  historyLoading,
  onClose,
}) => {
  const { t } = useTranslation();

  const historyColumns = [
    {
      title: t('ytScraper.scrapedAt'),
      dataIndex: 'scraped_at',
      key: 'scraped_at',
      width: 160,
      render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('ytScraper.estimatedRevenue'),
      dataIndex: 'estimated_revenue',
      key: 'estimated_revenue',
      width: 120,
      align: 'right' as const,
      render: (val: number | null) =>
        val != null ? (
          <Text strong style={{ color: '#52c41a' }}>
            {formatUSD(val)}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: t('ytScraper.views'),
      dataIndex: 'views',
      key: 'views',
      width: 110,
      align: 'right' as const,
      render: (val: number | null) => (val != null ? Number(val).toLocaleString() : '-'),
    },
    {
      title: t('ytScraper.watchTime'),
      dataIndex: 'watch_time_hours',
      key: 'watch_time_hours',
      width: 110,
      align: 'right' as const,
      render: (val: number | null) => (val != null ? `${Number(val).toLocaleString()} h` : '-'),
    },
    {
      title: t('ytScraper.avgWatchTime'),
      dataIndex: 'avg_watch_time',
      key: 'avg_watch_time',
      width: 110,
      align: 'right' as const,
      render: (val: string | null) => val || '-',
    },
    {
      title: t('ytScraper.period'),
      dataIndex: 'period',
      key: 'period',
      width: 130,
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          {t('ytScraper.scrapeHistory')}
          {kocHistory && kocHistory.length > 0 && kocHistory[0].koc && (
            <Tag color="blue">
              {kocHistory[0].koc.full_name} - {kocHistory[0].koc.channel_name}
            </Tag>
          )}
        </Space>
      }
      open={!!selectedKocId}
      onClose={onClose}
      width={900}
      destroyOnClose
    >
      <Table
        columns={historyColumns}
        dataSource={kocHistory || []}
        rowKey="id"
        size="small"
        bordered
        loading={historyLoading}
        locale={getTableLocale(t)}
        pagination={{ pageSize: 10 }}
      />
    </Drawer>
  );
};

export default ScrapeHistoryDrawer;
