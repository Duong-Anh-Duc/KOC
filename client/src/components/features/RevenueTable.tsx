import type { PaymentStatusMap, RevenueRecord, YouTubeScrapeResult } from '@/types';
import { formatUSD, formatVND, getTableLocale } from '@/utils';
import { DeleteOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Table, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { MonthlyRevenueModal } from '../revenue';
import RevenueDetailDrawer from './RevenueDetailDrawer';
import RevenueHistoryDrawer from './RevenueHistoryDrawer';
import { getRevenueColumns } from './RevenueTableColumns';

const { Text } = Typography;

interface RevenueTableProps {
  records: RevenueRecord[];
  totals?: Record<string, number>;
  loading?: boolean;
  cycleLocked?: boolean;
  onApprove?: (id: string) => void;
  onUnapprove?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;
  onEdit?: (record: RevenueRecord) => void;
  isAdmin?: boolean;
  canApprove?: boolean;
  canDelete?: boolean;
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
  onUnapprove,
  onDelete,
  onDeleteMany,
  onEdit,
  isAdmin,
  canApprove,
  canDelete,
  scrapeResults,
  scrapeHistory,
  scrapeHistoryLoading,
  onViewHistory,
  selectedHistoryKocId,
  onCloseHistory,
  paymentStatus,
}) => {
  const { t } = useTranslation();
  const darkMode = useAppStore((s) => s.darkMode);
  const [detailKocId, setDetailKocId] = useState<string | null>(null);
  const [monthlyKoc, setMonthlyKoc] = useState<{ id: string; name: string; channel: string } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Find scrape result for a KOC
  const getScrapeResult = (kocId: string): YouTubeScrapeResult | undefined => {
    return scrapeResults?.find(r => r.koc_id === kocId);
  };

  // Detail drawer data
  const detailRecord = detailKocId ? records.find(r => r.koc_id === detailKocId) || null : null;
  const detailScrape = detailKocId ? getScrapeResult(detailKocId) || null : null;

  // When rowSelection is active, the checkbox column shifts all summary cell indices by 1
  const sel = canDelete && !cycleLocked && (onDelete || onDeleteMany) ? 1 : 0;

  const columns = getRevenueColumns({
    t,
    cycleLocked,
    onApprove,
    onUnapprove,
    onDelete,
    onEdit,
    isAdmin,
    canApprove,
    canDelete,
    scrapeResults,
    paymentStatus,
    onViewDetail: (kocId) => setDetailKocId(kocId),
    onViewMonthly: (record) => setMonthlyKoc({
      id: record.koc_id,
      name: record.koc?.full_name || '',
      channel: record.koc?.channel_name || '',
    }),
  });

  return (
  <>
    {/* ===== Bulk Action Bar ===== */}
    {canDelete && !cycleLocked && (onDelete || onDeleteMany) && (
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {selectedRowKeys.length > 0 && (
          <>
            <span style={{ color: '#1677ff', fontWeight: 500 }}>
              {t('common.selected', 'Đã chọn')}: {selectedRowKeys.length}
            </span>
            <Popconfirm
              title={t('confirm.deleteSelected', `Xóa ${selectedRowKeys.length} bản ghi đã chọn?`)}
              onConfirm={() => {
                if (onDeleteMany) onDeleteMany(selectedRowKeys as string[]);
                setSelectedRowKeys([]);
              }}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Button danger size="small" icon={<DeleteOutlined />}>
                {t('common.deleteSelected', 'Xóa đã chọn')} ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              {t('common.cancel', 'Bỏ chọn')}
            </Button>
          </>
        )}
        {records.length > 0 && (
          <Popconfirm
            title={t('confirm.deleteAll', `Xóa tất cả ${records.length} bản ghi?`)}
            onConfirm={() => {
              if (onDeleteMany) onDeleteMany(records.map(r => r.id));
              setSelectedRowKeys([]);
            }}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button danger size="small" icon={<DeleteOutlined />} style={{ marginLeft: selectedRowKeys.length > 0 ? 8 : 0 }}>
              {t('common.deleteAll', 'Xóa tất cả')} ({records.length})
            </Button>
          </Popconfirm>
        )}
      </div>
    )}
    <Table<RevenueRecord>
      columns={columns}
      dataSource={records}
      rowKey="id"
      loading={loading}
      bordered
      locale={getTableLocale(t)}
      scroll={{ x: 'max-content' }}
      pagination={false}
      size="small"
      style={{ borderRadius: 8 }}
      rowSelection={canDelete && !cycleLocked && (onDelete || onDeleteMany) ? {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
        columnWidth: 40,
      } : undefined}
      onRow={(record, index) => {
        const getRowBgColor = () => {
          if (record.status === 'APPROVED') {
            return darkMode ? '#1a4620' : '#f6ffed';
          }
          return (index ?? 0) % 2 === 0
            ? (darkMode ? '#141414' : '#ffffff')
            : (darkMode ? '#1a1a1a' : '#fffef0');
        };
        const bgColor = getRowBgColor();
        const hoverBgColor = darkMode ? '#262626' : '#e6f4ff';

        return {
          style: {
            backgroundColor: bgColor,
            transition: 'background-color 0.15s',
          },
          onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = hoverBgColor; },
          onMouseLeave: (e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = bgColor;
          },
        };
      }}
      summary={() =>
        totals ? (
          <Table.Summary>
            <Table.Summary.Row style={{ fontWeight: 700 }}>
              <Table.Summary.Cell index={0} colSpan={3 + sel}>
                <Text strong style={{ color: '#1677ff' }}>{t('revenue.total')}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3 + sel} align="right">
                <Text strong>{formatUSD(totals.totalOriginal)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4 + sel} align="right">
                <Text strong style={{ color: '#722ed1' }}>{formatUSD(totals.totalCumulatedRevenue)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5 + sel} align="right">
                <Text strong>{formatUSD(totals.totalUsTax)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6 + sel} align="right">
                <Text strong>{formatUSD(totals.totalBankFee)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7 + sel} align="right">
                <Text strong>{formatUSD(totals.totalNetRevenue)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8 + sel} align="right">
                <Text strong>{formatUSD(totals.totalCompanyShare)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9 + sel} align="right">
                <Text strong>{formatUSD(totals.totalKocShareGross)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={10 + sel} align="right">
                <Text strong>{formatUSD(totals.totalKocTax)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={11 + sel} align="right">
                <Text strong style={{ color: '#1677ff', fontSize: 13 }}>{formatUSD(totals.totalKocReceiveUsd)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={12 + sel} align="right">
                <Text strong style={{ color: '#722ed1', fontSize: 13 }}>{formatUSD(totals.totalAccumulatedKocUsd)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={13 + sel} align="right">
                <Text strong style={{ color: '#52c41a', fontSize: 13 }}>{formatVND(totals.totalKocReceiveVnd)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        ) : null
      }
    />

    {/* ===== Detail Drawer - Country Breakdown ===== */}
    <RevenueDetailDrawer
      detailKocId={detailKocId}
      detailRecord={detailRecord}
      detailScrape={detailScrape}
      onClose={() => setDetailKocId(null)}
      onViewHistory={onViewHistory}
    />

    {/* ===== History Drawer ===== */}
    <RevenueHistoryDrawer
      selectedHistoryKocId={selectedHistoryKocId}
      scrapeHistory={scrapeHistory}
      scrapeHistoryLoading={scrapeHistoryLoading}
      onClose={onCloseHistory}
    />

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
