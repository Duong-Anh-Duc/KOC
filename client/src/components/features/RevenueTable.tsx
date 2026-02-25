import type { PaymentStatusMap, RevenueByCountry, RevenueRecord, YouTubeScrapeResult } from '@/types';
import { formatUSD, formatVND, getTableLocale } from '@/utils';
import {
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonthlyRevenueModal } from '../revenue';

const { Text } = Typography;

interface RevenueTableProps {
  records: RevenueRecord[];
  totals?: Record<string, number>;
  loading?: boolean;
  cycleLocked?: boolean;
  onApprove?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (record: RevenueRecord) => void;
  isAdmin?: boolean;
  /** Latest scrape results for each KOC - used for country breakdown */
  scrapeResults?: YouTubeScrapeResult[];
  /** Scrape history for selected KOC */
  scrapeHistory?: YouTubeScrapeResult[];
  scrapeHistoryLoading?: boolean;
  /** Callback when user wants to see scrape history */
  onViewHistory?: (kocId: string) => void;
  /** Currently selected KOC ID for history */
  selectedHistoryKocId?: string | null;
  onCloseHistory?: () => void;
  /** Payment status per KOC */
  paymentStatus?: PaymentStatusMap;
}

const RevenueTable: React.FC<RevenueTableProps> = ({
  records,
  totals,
  loading,
  cycleLocked,
  onApprove,
  onDelete,
  onEdit,
  isAdmin,
  scrapeResults,
  scrapeHistory,
  scrapeHistoryLoading,
  onViewHistory,
  selectedHistoryKocId,
  onCloseHistory,
  paymentStatus,
}) => {
  const { t } = useTranslation();
  const [detailKocId, setDetailKocId] = useState<string | null>(null);
  const [monthlyKoc, setMonthlyKoc] = useState<{ id: string; name: string; channel: string } | null>(null);

  // Find scrape result for a KOC
  const getScrapeResult = (kocId: string): YouTubeScrapeResult | undefined => {
    return scrapeResults?.find(r => r.koc_id === kocId);
  };

  // Country breakdown columns
  const countryColumns: ColumnsType<RevenueByCountry> = [
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

  // History drawer columns
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

  // Detail drawer data
  const detailRecord = detailKocId ? records.find(r => r.koc_id === detailKocId) : null;
  const detailScrape = detailKocId ? getScrapeResult(detailKocId) : null;

  const columns: ColumnsType<RevenueRecord> = [
    {
      title: 'STT',
      key: 'stt',
      fixed: 'left',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('koc.fullName'),
      dataIndex: ['koc', 'full_name'],
      key: 'koc_name',
      fixed: 'left',
      width: 160,
      ellipsis: { showTitle: false },
      render: (val: string) => (
        <Tooltip title={val} placement="topLeft">
          <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '-'}</Text>
        </Tooltip>
      ),
    },
    {
      title: t('koc.channelName'),
      dataIndex: ['koc', 'channel_name'],
      key: 'channel_name',
      width: 140,
      ellipsis: { showTitle: false },
      render: (val: string) => val ? (
        <Tooltip title={val} placement="topLeft">
          <Text style={{ color: '#1677ff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</Text>
        </Tooltip>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('revenue.originalRevenue'),
      dataIndex: 'original_revenue_usd',
      key: 'original_revenue_usd',
      width: 140,
      align: 'right',
      render: (val: number, record: RevenueRecord) => {
        const status = paymentStatus?.[record.koc_id];
        const belowThreshold = status?.belowThreshold;
        const tooltipContent = status && belowThreshold ? (
          <div>
            <div style={{ marginBottom: 4 }}>
              {t('revenue.belowThresholdTitle', { threshold: `$${status.threshold}` })}
            </div>
            <div style={{ marginBottom: 4 }}>
              {t('revenue.accumulatedTotal')}: <strong>${status.accumulated.toFixed(2)}</strong>
            </div>
            {status.accumulatedMonths.map((m, i) => (
              <div key={i} style={{ fontSize: 12 }}>
                {m.month}: ${m.revenue.toFixed(2)}
              </div>
            ))}
          </div>
        ) : null;
        return (
          <span>
            {formatUSD(val)}
            {belowThreshold && tooltipContent && (
              <Tooltip title={tooltipContent}>
                <WarningOutlined style={{ color: '#faad14', marginLeft: 6, fontSize: 12 }} />
              </Tooltip>
            )}
          </span>
        );
      },
    },
    {
      title: t('revenue.usTax'),
      dataIndex: 'us_tax_deduction',
      key: 'us_tax_deduction',
      width: 120,
      align: 'right',
      render: (val: number) => formatUSD(val),
    },
    {
      title: t('revenue.bankFee'),
      dataIndex: 'bank_fee',
      key: 'bank_fee',
      width: 120,
      align: 'right',
      render: (val: number) => formatUSD(val),
    },
    {
      title: t('revenue.netRevenue'),
      dataIndex: 'net_revenue',
      key: 'net_revenue',
      width: 140,
      align: 'right',
      render: (val: number) => <strong>{formatUSD(Math.max(0, val))}</strong>,
    },
    {
      title: t('revenue.companyShare'),
      dataIndex: 'company_share',
      key: 'company_share',
      width: 130,
      align: 'right',
      render: (val: number) => formatUSD(val),
    },
    {
      title: t('revenue.kocShareGross'),
      dataIndex: 'koc_share_gross',
      key: 'koc_share_gross',
      width: 130,
      align: 'right',
      render: (val: number) => formatUSD(val),
    },
    {
      title: t('revenue.kocTax'),
      dataIndex: 'koc_tax_deduction',
      key: 'koc_tax_deduction',
      width: 120,
      align: 'right',
      render: (val: number) => formatUSD(val),
    },
    {
      title: t('revenue.kocReceiveUsd'),
      dataIndex: 'koc_receive_usd',
      key: 'koc_receive_usd',
      width: 140,
      align: 'right',
      render: (val: number) => <Text strong style={{ color: '#1677ff', fontSize: 13 }}>{formatUSD(Math.max(0, val))}</Text>,
    },
    {
      title: t('revenue.kocReceiveVnd'),
      dataIndex: 'koc_receive_vnd',
      key: 'koc_receive_vnd',
      width: 160,
      align: 'right',
      render: (val: number) => <Text strong style={{ color: '#52c41a', fontSize: 13 }}>{formatVND(Math.max(0, val))}</Text>,
    },
    {
      title: t('revenue.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (status: string) => (
        <Tag
          color={status === 'APPROVED' ? 'success' : 'warning'}
          style={{ fontWeight: 600, minWidth: 64, textAlign: 'center', borderRadius: 12 }}
        >
          {status === 'APPROVED' ? t('status.approved') : t('status.pending')}
        </Tag>
      ),
    },
    {
      title: t('revenue.pubCodeCheck'),
      key: 'pub_code_check',
      width: 110,
      align: 'center',
      render: (_: unknown, record: RevenueRecord) => {
        const stored = record.koc?.pub_code || null;
        const scraped = record.scraped_pub_code;
        const match = record.pub_code_match;

        if (match === true) {
          return (
            <Tooltip title={t('revenue.pubCodeMatched', { code: scraped })}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            </Tooltip>
          );
        } else if (match === false) {
          return (
            <Tooltip title={t('revenue.pubCodeMismatch', { stored, scraped })}>
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            </Tooltip>
          );
        } else {
          return (
            <Tooltip title={t('revenue.pubCodeNotScraped')}>
              <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />
            </Tooltip>
          );
        }
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      fixed: 'right',
      width: 120,
      align: 'center',
      render: (_: unknown, record: RevenueRecord) => (
        <Space size="small">
          {/* Monthly Revenue Analytics button */}
          <Tooltip title={t('ytScraper.viewMonthlyRevenue')}>
            <Button
              type="text"
              size="small"
              icon={<BarChartOutlined style={{ color: '#ED8F3A' }} />}
              onClick={() => setMonthlyKoc({
                id: record.koc_id,
                name: record.koc?.full_name || '',
                channel: record.koc?.channel_name || '',
              })}
              style={{ padding: '4px 8px' }}
            />
          </Tooltip>
          {scrapeResults && (
            <Tooltip title={t('common.viewDetails')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ color: '#722ed1' }} />}
                onClick={() => setDetailKocId(record.koc_id)}
                style={{ padding: '4px 8px' }}
              />
            </Tooltip>
          )}
          {!cycleLocked && onEdit && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#1677ff' }} />}
                onClick={() => onEdit(record)}
                style={{ padding: '4px 8px' }}
              />
            </Tooltip>
          )}
          {isAdmin && record.status === 'PENDING' && onApprove && (() => {
            const status = paymentStatus?.[record.koc_id];
            const belowThreshold = status?.belowThreshold;
            return belowThreshold ? (
              <Tooltip title={t('revenue.cannotApproveThreshold', { accumulated: status?.accumulated?.toFixed(2), threshold: status?.threshold ?? 100 })}>
                <Button
                  type="text"
                  size="small"
                  icon={<WarningOutlined style={{ color: '#faad14' }} />}
                  disabled
                  style={{ padding: '4px 8px' }}
                />
              </Tooltip>
            ) : (
              <Tooltip title={t('revenue.approve')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => onApprove(record.id)}
                  style={{ padding: '4px 8px' }}
                />
              </Tooltip>
            );
          })()}
          {isAdmin && !cycleLocked && onDelete && (
            <Popconfirm
              title={t('confirm.delete')}
              onConfirm={() => onDelete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip title={t('common.delete')}>
                <Button
                  type="text"
                  size="small" 
                  icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
                  style={{ padding: '4px 8px' }}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
  <>
    <Table<RevenueRecord>
      columns={columns}
      dataSource={records}
      rowKey="id"
      loading={loading}
      bordered
      locale={getTableLocale(t)}
      scroll={{ x: 1800 }}
      pagination={false}
      size="small"
      style={{ borderRadius: 8 }}
      onRow={(record, index) => ({
        style: {
          backgroundColor:
            record.status === 'APPROVED'
              ? '#f6ffed'
              : (index ?? 0) % 2 === 0 ? '#ffffff' : '#fffef0',
          transition: 'background-color 0.15s',
        },
        onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e6f4ff'; },
        onMouseLeave: (e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            record.status === 'APPROVED'
              ? '#f6ffed'
              : (index ?? 0) % 2 === 0 ? '#ffffff' : '#fffef0';
        },
      })}
      summary={() =>
        totals ? (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ backgroundColor: '#e6f4ff', fontWeight: 700 }}>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong style={{ color: '#1677ff' }}>{t('revenue.total')}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong>{formatUSD(totals.totalOriginal)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} colSpan={2} />
              <Table.Summary.Cell index={6} align="right">
                <Text strong>{formatUSD(totals.totalNetRevenue)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <Text strong>{formatUSD(totals.totalCompanyShare)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} colSpan={2} />
              <Table.Summary.Cell index={10} align="right">
                <Text strong style={{ color: '#1677ff', fontSize: 13 }}>{formatUSD(totals.totalKocReceiveUsd)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={11} align="right">
                <Text strong style={{ color: '#52c41a', fontSize: 13 }}>{formatVND(totals.totalKocReceiveVnd)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={12} colSpan={3} />
            </Table.Summary.Row>
          </Table.Summary>
        ) : null
      }
    />

    {/* ===== Detail Drawer - Country Breakdown ===== */}
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
      onClose={() => setDetailKocId(null)}
      width={850}
      destroyOnClose
      footer={
        detailKocId && onViewHistory && (
          <Button
            icon={<HistoryOutlined />}
            onClick={() => { onViewHistory(detailKocId); setDetailKocId(null); }}
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

    {/* ===== History Drawer ===== */}
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
      onClose={onCloseHistory}
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
    
    {/* ===== Monthly Revenue Analytics Modal ===== */}
    <MonthlyRevenueModal
      open={!!monthlyKoc}
      onClose={() => setMonthlyKoc(null)}
      kocId={monthlyKoc?.id || null}
      kocName={monthlyKoc?.name}
      channelName={monthlyKoc?.channel}
    />
  </>
  );
};

export default RevenueTable;
