import {
    CalendarOutlined,
    DatabaseOutlined,
    HistoryOutlined,
    LoadingOutlined,
    PlayCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Grid, Space, Table, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueByCountry, YouTubeScrapeResult } from '../../types';
import { formatUSD, getTableLocale } from '../../utils';

const { useBreakpoint } = Grid;

const { Text } = Typography;

interface LatestResultsTableProps {
  latestResults: YouTubeScrapeResult[] | undefined;
  latestLoading: boolean;
  isLoggedIn: boolean;
  asyncJobStatus: string | null;
  scrapeAllLoading: boolean;
  onScrapeAll: () => void;
  onRefresh: () => void;
  onViewHistory: (kocId: string) => void;
  scrapeAllMonthlyLoading: boolean;
  onScrapeAllMonthly: () => void;
  readOnly?: boolean;
}

const LatestResultsTable: React.FC<LatestResultsTableProps> = ({
  latestResults,
  latestLoading,
  isLoggedIn,
  asyncJobStatus,
  scrapeAllLoading,
  onScrapeAll,
  onRefresh,
  onViewHistory,
  scrapeAllMonthlyLoading,
  onScrapeAllMonthly,
  readOnly,
}) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const latestResultsColumns = [
    {
      title: t('common.stt'),
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: t('ytScraper.kocName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 160,
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: t('ytScraper.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 160,
    },
    {
      title: t('ytScraper.estimatedRevenue'),
      dataIndex: 'estimated_revenue',
      key: 'estimated_revenue',
      width: 140,
      align: 'right' as const,
      sorter: (a: YouTubeScrapeResult, b: YouTubeScrapeResult) => (a.estimated_revenue || 0) - (b.estimated_revenue || 0),
      render: (val: number | null) =>
        val != null ? (
          <Text strong style={{ color: '#52c41a', fontSize: 14 }}>
            {Number(val) < 0.01 && Number(val) > 0 ? `$${Number(val).toFixed(3)}` : formatUSD(val)}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: t('ytScraper.views'),
      dataIndex: 'views',
      key: 'views',
      width: 120,
      align: 'right' as const,
      responsive: ['md'] as any,
      sorter: (a: YouTubeScrapeResult, b: YouTubeScrapeResult) => (a.views || 0) - (b.views || 0),
      render: (val: number | null) => (val != null ? <Text>{Number(val).toLocaleString()}</Text> : '-'),
    },
    {
      title: t('ytScraper.watchTime'),
      dataIndex: 'watch_time_hours',
      key: 'watch_time_hours',
      width: 130,
      align: 'right' as const,
      responsive: ['lg'] as any,
      sorter: (a: YouTubeScrapeResult, b: YouTubeScrapeResult) => (a.watch_time_hours || 0) - (b.watch_time_hours || 0),
      render: (val: number | null) =>
        val != null ? (
          <Text>
            {Number(val).toLocaleString()} {t('ytScraper.hours')}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: t('ytScraper.avgWatchTime'),
      dataIndex: 'avg_watch_time',
      key: 'avg_watch_time',
      width: 130,
      align: 'right' as const,
      responsive: ['xl'] as any,
      render: (val: string | null) => val || '-',
    },
    {
      title: t('ytScraper.period'),
      dataIndex: 'period',
      key: 'period',
      width: 140,
      responsive: ['lg'] as any,
      render: (val: string | null) => (val ? <Tag>{val}</Tag> : '-'),
    },
    {
      title: t('ytScraper.lastScraped'),
      dataIndex: 'scraped_at',
      key: 'scraped_at',
      width: 160,
      responsive: ['md'] as any,
      sorter: (a: YouTubeScrapeResult, b: YouTubeScrapeResult) =>
        new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime(),
      render: (val: string) => (
        <Tooltip title={dayjs(val).format('DD/MM/YYYY HH:mm')}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(val).format('DD/MM/YYYY HH:mm')}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      render: (_: any, record: YouTubeScrapeResult) => (
        <Button size="small" icon={<HistoryOutlined />} onClick={() => onViewHistory(record.koc_id)}>
          {t('ytScraper.viewHistory')}
        </Button>
      ),
    },
  ];

  const countryColumns = [
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
      align: 'right' as const,
      render: (val: number | null, record: RevenueByCountry) =>
        val != null ? (
          <span>
            <Text strong style={{ color: '#52c41a' }}>
              {Number(val) < 0.01 && Number(val) > 0 ? `$${Number(val).toFixed(3)}` : formatUSD(val)}
            </Text>
            {record.revenuePercent != null && (
              <Text type="secondary" style={{ marginLeft: 4 }}>
                ({record.revenuePercent}%)
              </Text>
            )}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: t('ytScraper.views'),
      dataIndex: 'views',
      key: 'views',
      width: 120,
      align: 'right' as const,
      render: (val: number | null, record: RevenueByCountry) =>
        val != null ? (
          <span>
            {Number(val).toLocaleString()}
            {record.viewsPercent != null && (
              <Text type="secondary" style={{ marginLeft: 4 }}>
                ({record.viewsPercent}%)
              </Text>
            )}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: t('ytScraper.watchTime'),
      dataIndex: 'watchTimeHours',
      key: 'watchTimeHours',
      width: 130,
      align: 'right' as const,
      render: (val: number | null, record: RevenueByCountry) =>
        val != null ? (
          <span>
            {Number(val).toLocaleString()} {t('ytScraper.hours')}
            {record.watchTimePercent != null && (
              <Text type="secondary" style={{ marginLeft: 4 }}>
                ({record.watchTimePercent}%)
              </Text>
            )}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: t('ytScraper.avgWatchTime'),
      dataIndex: 'avgWatchTime',
      key: 'avgWatchTime',
      width: 120,
      align: 'right' as const,
      render: (val: string | null) => val || '-',
    },
  ];

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          {t('ytScraper.latestResults')}
          {latestResults && latestResults.length > 0 && <Tag color="green">{latestResults.length} {t('common.kocs')}</Tag>}
        </Space>
      }
      extra={
        <Space>
          {!readOnly && (
            <>
              <Button
                icon={scrapeAllMonthlyLoading ? <LoadingOutlined /> : <CalendarOutlined />}
                onClick={onScrapeAllMonthly}
                loading={scrapeAllMonthlyLoading}
                disabled={!isLoggedIn || scrapeAllMonthlyLoading}
              >
                Cào tất cả tháng
              </Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={onScrapeAll}
                loading={scrapeAllLoading}
                disabled={!isLoggedIn}
              >
                {t('ytScraper.scrapeAll')}
              </Button>
            </>
          )}
          <Tooltip title={t('ytScraper.refreshResults')}>
            <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={latestLoading} />
          </Tooltip>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {(asyncJobStatus === 'pending' || asyncJobStatus === 'running') && (
        <Alert
          type="info"
          showIcon
          icon={<LoadingOutlined />}
          message={`${t('ytScraper.backgroundJob')}: ${asyncJobStatus === 'pending' ? t('ytScraper.preparing') : t('ytScraper.scrapingData')}`}
          style={{ marginBottom: 16 }}
        />
      )}
      {asyncJobStatus === 'completed' && (
        <Alert
          type="success"
          showIcon
          closable
          message={`${t('ytScraper.jobCompleted')} — ${t('ytScraper.savedToDb')}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {t('ytScraper.latestResultsDesc')}
      </Text>

      <Table
        columns={latestResultsColumns}
        dataSource={latestResults || []}
        rowKey="id"
        size="small"
        bordered
        loading={latestLoading}
        locale={getTableLocale(t)}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
        scroll={{ x: isMobile ? 'max-content' : 1400 }}
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
        summary={(pageData) => {
          if (pageData.length === 0) return null;
          const totalRevenue = pageData.reduce((s, r) => s + (r.estimated_revenue || 0), 0);
          const totalViews = pageData.reduce((s, r) => s + (r.views || 0), 0);
          const totalWatchTime = pageData.reduce((s, r) => s + (r.watch_time_hours || 0), 0);
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3} align="right">
                <Text strong>{t('common.total')}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong style={{ color: '#52c41a', fontSize: 15 }}>
                  {formatUSD(totalRevenue)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong>{Number(totalViews).toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong>
                  {Number(totalWatchTime).toLocaleString()} {t('ytScraper.hours')}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} colSpan={4} />
            </Table.Summary.Row>
          );
        }}
      />
    </Card>
  );
};

export default LatestResultsTable;
