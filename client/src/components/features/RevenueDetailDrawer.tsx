import type { RevenueByCountry, RevenueRecord, YouTubeScrapeResult } from '@/types';
import {
    EyeOutlined,
    HistoryOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export function getCountryColumns(t: (key: string) => string): ColumnsType<RevenueByCountry> {
  return [
    {
      title: t('ytScraper.country'),
      dataIndex: 'country',
      key: 'country',
      width: 160,
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: t('ytScraper.estimatedRevenue'),
      dataIndex: 'estimatedRevenue',
      key: 'estimatedRevenue',
      width: 140,
      align: 'right',
      render: (val: number | null, record: RevenueByCountry) => val != null ? (
        <span>
          <Text strong style={{ color: '#52c41a' }}>${Number(val) < 0.01 && Number(val) > 0 ? Number(val).toFixed(3) : Number(val).toFixed(2)}</Text>
          {record.revenuePercent != null && <Text type="secondary" style={{ marginLeft: 4 }}>({record.revenuePercent}%)</Text>}
        </span>
      ) : '-',
    },
    {
      title: t('ytScraper.views'),
      dataIndex: 'views',
      key: 'views',
      width: 120,
      align: 'right',
      render: (val: number | null, record: RevenueByCountry) => val != null ? (
        <span>
          {Number(val).toLocaleString()}
          {record.viewsPercent != null && <Text type="secondary" style={{ marginLeft: 4 }}>({record.viewsPercent}%)</Text>}
        </span>
      ) : '-',
    },
    {
      title: t('ytScraper.watchTime'),
      dataIndex: 'watchTimeHours',
      key: 'watchTimeHours',
      width: 130,
      align: 'right',
      render: (val: number | null, record: RevenueByCountry) => val != null ? (
        <span>
          {Number(val).toLocaleString()} {t('ytScraper.hours')}
          {record.watchTimePercent != null && <Text type="secondary" style={{ marginLeft: 4 }}>({record.watchTimePercent}%)</Text>}
        </span>
      ) : '-',
    },
    {
      title: t('ytScraper.avgWatchTime'),
      dataIndex: 'avgWatchTime',
      key: 'avgWatchTime',
      width: 120,
      align: 'right',
      render: (val: string | null) => val || '-',
    },
  ];
}

interface RevenueDetailDrawerProps {
  detailKocId: string | null;
  detailRecord: RevenueRecord | null;
  detailScrape: YouTubeScrapeResult | undefined | null;
  onClose: () => void;
  onViewHistory?: (kocId: string) => void;
}

const RevenueDetailDrawer: React.FC<RevenueDetailDrawerProps> = ({
  detailKocId,
  detailRecord,
  detailScrape,
  onClose,
  onViewHistory,
}) => {
  const { t } = useTranslation();
  const countryColumns = getCountryColumns(t);

  return (
    <Drawer
      title={
        <Space>
          <EyeOutlined />
          {t('common.viewDetails')}
          {detailRecord && (
            <Tag color="blue">{detailRecord.koc?.full_name} - {detailRecord.koc?.channel_name}</Tag>
          )}
        </Space>
      }
      open={!!detailKocId}
      onClose={onClose}
      width={850}
      destroyOnClose
      footer={
        detailKocId && onViewHistory && (
          <Button
            icon={<HistoryOutlined />}
            onClick={() => { onViewHistory(detailKocId); onClose(); }}
          >
            {t('ytScraper.viewHistory')}
          </Button>
        )
      }
    >
      {detailScrape ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space size="large">
              <span><Text type="secondary">{t('ytScraper.estimatedRevenue')}:</Text> <Text strong style={{ color: '#52c41a', fontSize: 16 }}>${Number(detailScrape.estimated_revenue || 0) < 0.01 && Number(detailScrape.estimated_revenue || 0) > 0 ? Number(detailScrape.estimated_revenue || 0).toFixed(3) : Number(detailScrape.estimated_revenue || 0).toFixed(2)}</Text></span>
              <span><Text type="secondary">{t('ytScraper.views')}:</Text> <Text strong>{Number(detailScrape.views || 0).toLocaleString()}</Text></span>
              <span><Text type="secondary">{t('ytScraper.watchTime')}:</Text> <Text strong>{Number(detailScrape.watch_time_hours || 0).toLocaleString()} h</Text></span>
              <span><Text type="secondary">{t('ytScraper.lastScraped')}:</Text> <Text>{dayjs(detailScrape.scraped_at).format('DD/MM/YYYY HH:mm')}</Text></span>
            </Space>
          </div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('ytScraper.country')} ({detailScrape.country_data?.length || 0})</Text>
          <Table
            columns={countryColumns}
            dataSource={detailScrape.country_data || []}
            rowKey="country"
            size="small"
            bordered
            pagination={false}
          />
        </>
      ) : (
        <Text type="secondary">{t('ytScraper.noCountryData')}</Text>
      )}
    </Drawer>
  );
};

export default RevenueDetailDrawer;
