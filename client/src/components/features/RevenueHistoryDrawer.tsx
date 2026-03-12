import type { YouTubeScrapeResult } from '@/types';
import { getTableLocale } from '@/utils';
import {
    HistoryOutlined,
} from '@ant-design/icons';
import { Drawer, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getCountryColumns } from './RevenueDetailDrawer';

const { Text } = Typography;

interface RevenueHistoryDrawerProps {
  selectedHistoryKocId?: string | null;
  scrapeHistory?: YouTubeScrapeResult[];
  scrapeHistoryLoading?: boolean;
  onClose?: () => void;
}

const RevenueHistoryDrawer: React.FC<RevenueHistoryDrawerProps> = ({
  selectedHistoryKocId,
  scrapeHistory,
  scrapeHistoryLoading,
  onClose,
}) => {
  const { t } = useTranslation();
  const countryColumns = getCountryColumns(t);

  const historyColumns: ColumnsType<YouTubeScrapeResult> = [
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
      align: 'right',
      render: (val: number | null) => val != null ? <Text strong style={{ color: '#52c41a' }}>${Number(val) < 0.01 && Number(val) > 0 ? Number(val).toFixed(3) : Number(val).toFixed(2)}</Text> : '-',
    },
    {
      title: t('ytScraper.views'),
      dataIndex: 'views',
      key: 'views',
      width: 110,
      align: 'right',
      render: (val: number | null) => val != null ? Number(val).toLocaleString() : '-',
    },
    {
      title: t('ytScraper.watchTime'),
      dataIndex: 'watch_time_hours',
      key: 'watch_time_hours',
      width: 110,
      align: 'right',
      render: (val: number | null) => val != null ? `${Number(val).toLocaleString()} h` : '-',
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
          {scrapeHistory && scrapeHistory.length > 0 && scrapeHistory[0].koc && (
            <Tag color="blue">{scrapeHistory[0].koc.full_name} - {scrapeHistory[0].koc.channel_name}</Tag>
          )}
        </Space>
      }
      open={!!selectedHistoryKocId}
      onClose={onClose}
      width={850}
      destroyOnClose
    >
      <Table
        columns={historyColumns}
        dataSource={scrapeHistory || []}
        rowKey="id"
        size="small"
        bordered
        loading={scrapeHistoryLoading}
        locale={getTableLocale(t)}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record: YouTubeScrapeResult) => {
            const countries = record.country_data;
            if (!countries || countries.length === 0) {
              return <Text type="secondary">{t('ytScraper.noCountryData')}</Text>;
            }
            return (
              <Table
                columns={countryColumns}
                dataSource={countries}
                rowKey="country"
                size="small"
                bordered
                pagination={false}
                style={{ margin: '8px 0' }}
              />
            );
          },
          rowExpandable: (record: YouTubeScrapeResult) => !!record.country_data && record.country_data.length > 0,
        }}
      />
    </Drawer>
  );
};

export default RevenueHistoryDrawer;
