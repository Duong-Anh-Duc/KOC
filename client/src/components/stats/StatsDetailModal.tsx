import { Grid, Modal, Spin, Table, Tabs, Typography } from 'antd';
import { AppSpin, AppTabs, AppTooltip } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getTableLocale } from '../../utils';

const { useBreakpoint } = Grid;

const { Text } = Typography;

interface StatsDetailModalProps {
  open: boolean;
  channelName: string;
  detailData: {
    byCountry: { totals: Record<string, any>; rows: any[] } | null;
    byDay: { totals: Record<string, any>; rows: any[] } | null;
  } | null;
  loading: boolean;
  onClose: () => void;
}

const fmt = (val: number | null | undefined): string => {
  if (val == null) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
};

const fmtDec = (val: number | null | undefined): string => {
  if (val == null) return '—';
  return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const fmtDollar = (val: number | null | undefined): string => {
  if (val == null) return '—';
  return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
};

const fmtPct = (val: number | null | undefined): string => {
  if (val == null) return '';
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
};

/** Format date from "12 thg 2, 2026" or "Feb 12, 2026" to "12/02/2026" */
const fmtDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  
  // Match Vietnamese format: "12 thg 2, 2026" or "12 thg 2"
  const viMatch = dateStr.match(/^(\d{1,2})\s+thg\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  if (viMatch) {
    const day = viMatch[1].padStart(2, '0');
    const month = viMatch[2].padStart(2, '0');
    const year = viMatch[3] || new Date().getFullYear().toString();
    return `${day}/${month}/${year}`;
  }
  
  // Match English format: "Feb 12, 2026" or "Feb 12"
  const enMatch = dateStr.match(/^([A-Z][a-z]{2})\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  if (enMatch) {
    const monthMap: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const month = monthMap[enMatch[1]] || '01';
    const day = enMatch[2].padStart(2, '0');
    const year = enMatch[3] || new Date().getFullYear().toString();
    return `${day}/${month}/${year}`;
  }
  
  return dateStr; // Return original if no match
};

const StatsDetailModal: React.FC<StatsDetailModalProps> = ({
  open,
  channelName,
  detailData,
  loading,
  onClose,
}) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const modalWidth = !screens.md ? '95vw' : !screens.lg ? '90vw' : 1200;

  const countryColumns = [
    {
      title: t('stats.country'),
      dataIndex: 'country',
      width: 160,
      fixed: 'left' as const,
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: t('stats.subsGained'),
      dataIndex: 'subscribersGained',
      width: 120,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.subscribersGained || 0) - (b.subscribersGained || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.subscribersGainedPercent != null && <Text type="secondary">{fmtPct(rec.subscribersGainedPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.subsLost'),
      dataIndex: 'subscribersLost',
      width: 120,
      align: 'right' as const,
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.subscribersLostPercent != null && <Text type="secondary">{fmtPct(rec.subscribersLostPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.likes'),
      dataIndex: 'likes',
      width: 120,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.likes || 0) - (b.likes || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.likesPercent != null && <Text type="secondary">{fmtPct(rec.likesPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.dislikes'),
      dataIndex: 'dislikes',
      width: 110,
      align: 'right' as const,
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.dislikesPercent != null && <Text type="secondary">{fmtPct(rec.dislikesPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.likeRatio'),
      dataIndex: 'likeRatio',
      width: 90,
      align: 'right' as const,
      render: (val: number | null) => <span>{val != null ? fmtPct(val) : '—'}</span>,
    },
    {
      title: t('stats.shares'),
      dataIndex: 'shares',
      width: 110,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.shares || 0) - (b.shares || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.sharesPercent != null && <Text type="secondary">{fmtPct(rec.sharesPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.views'),
      dataIndex: 'views',
      width: 130,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.views || 0) - (b.views || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.viewsPercent != null && <Text type="secondary">{fmtPct(rec.viewsPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.watchTime'),
      dataIndex: 'watchTimeHours',
      width: 130,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.watchTimeHours || 0) - (b.watchTimeHours || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmtDec(val)} {rec.watchTimePercent != null && <Text type="secondary">{fmtPct(rec.watchTimePercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.subsNet'),
      dataIndex: 'subscribersNet',
      width: 110,
      align: 'right' as const,
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.subscribersNetPercent != null && <Text type="secondary">{fmtPct(rec.subscribersNetPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.revenue'),
      dataIndex: 'estimatedRevenue',
      width: 130,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.estimatedRevenue || 0) - (b.estimatedRevenue || 0),
      render: (val: number | null, rec: any) => (
        <Text strong style={{ color: '#faad14' }}>
          {fmtDollar(val)} {rec.revenuePercent != null && <Text type="secondary">{fmtPct(rec.revenuePercent)}</Text>}
        </Text>
      ),
    },
    {
      title: t('stats.avgWatchTime'),
      dataIndex: 'avgWatchTime',
      width: 90,
      align: 'center' as const,
      render: (val: string | null) => <span>{val || '—'}</span>,
    },
  ];

  const dayColumns = [
    {
      title: t('stats.day'),
      dataIndex: 'date',
      width: 120,
      fixed: 'left' as const,
      render: (val: string) => <Text strong>{fmtDate(val)}</Text>,
    },
    {
      title: t('stats.views'),
      dataIndex: 'views',
      width: 140,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.views || 0) - (b.views || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmt(val)} {rec.viewsPercent != null && <Text type="secondary">{fmtPct(rec.viewsPercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.watchTime'),
      dataIndex: 'watchTimeHours',
      width: 140,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.watchTimeHours || 0) - (b.watchTimeHours || 0),
      render: (val: number | null, rec: any) => (
        <span>{fmtDec(val)} {rec.watchTimePercent != null && <Text type="secondary">{fmtPct(rec.watchTimePercent)}</Text>}</span>
      ),
    },
    {
      title: t('stats.avgWatchTime'),
      dataIndex: 'avgWatchTime',
      width: 120,
      align: 'center' as const,
      render: (val: string | null) => <span>{val || '—'}</span>,
    },
    {
      title: t('stats.revenue'),
      dataIndex: 'estimatedRevenue',
      width: 140,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.estimatedRevenue || 0) - (b.estimatedRevenue || 0),
      render: (val: number | null, rec: any) => (
        <Text strong style={{ color: '#faad14' }}>
          {fmtDollar(val)} {rec.revenuePercent != null && <Text type="secondary">{fmtPct(rec.revenuePercent)}</Text>}
        </Text>
      ),
    },
  ];

  const countryRows = detailData?.byCountry?.rows || [];
  const dayRows = detailData?.byDay?.rows || [];

  // Add totals row at the beginning of country table
  const countryDataWithTotals = detailData?.byCountry?.totals
    ? [{ country: t('stats.totalRow'), ...detailData.byCountry.totals, _isTotal: true }, ...countryRows]
    : countryRows;

  // Add totals row at the beginning of day table
  const dayDataWithTotals = detailData?.byDay?.totals
    ? [{ date: t('stats.totalRow'), ...detailData.byDay.totals, _isTotal: true }, ...dayRows]
    : dayRows;

  return (
    <Modal
      title={`${t('stats.detailTitle')} - ${channelName}`}
      open={open}
      onCancel={onClose}
      width={modalWidth}
      footer={null}
    >
      <AppSpin spinning={loading}>
        {/* AntD-original: <Tabs items={...} /> */}
        <AppTabs
          items={[
            {
              key: 'country',
              label: t('stats.byCountry'),
              children: (
                <Table
                  columns={countryColumns}
                  dataSource={countryDataWithTotals}
                  rowKey={(_, i) => `country-${i}`}
                  bordered
                  size="small"
                  locale={getTableLocale(t)}
                  pagination={{
                    defaultPageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `${t('common.total')}: ${total}`,
                  }}
                  scroll={{ x: 1600 }}
                  rowClassName={(record: any) => record._isTotal ? 'stats-total-row' : ''}
                />
              ),
            },
            {
              key: 'day',
              label: t('stats.byDay'),
              children: (
                <Table
                  columns={dayColumns}
                  dataSource={dayDataWithTotals}
                  rowKey={(_, i) => `day-${i}`}
                  bordered
                  size="small"
                  locale={getTableLocale(t)}
                  pagination={{
                    defaultPageSize: 28,
                    showSizeChanger: true,
                    showTotal: (total) => `${t('common.total')}: ${total}`,
                  }}
                  scroll={{ x: 800 }}
                  rowClassName={(record: any) => record._isTotal ? 'stats-total-row' : ''}
                />
              ),
            },
          ]}
        />
      </AppSpin>
    </Modal>
  );
};

export default StatsDetailModal;
