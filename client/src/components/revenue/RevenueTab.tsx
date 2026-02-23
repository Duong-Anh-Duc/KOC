import {
    CheckCircleOutlined,
    CloudSyncOutlined,
    DollarOutlined,
    LoadingOutlined,
    LockOutlined,
    ReloadOutlined,
    TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Empty, Row, Select, Space, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle, RevenueRecord, YouTubeScrapeResult } from '../../types';
import { formatUSD, formatVND } from '../../utils';
import { SummaryBar } from '../common';
import { RevenueTable } from '../features';

const { Text } = Typography;

const statusColorMap: Record<string, string> = {
  OPEN: 'blue',
  LOCKED: 'orange',
  COMPLETED: 'green',
  PAYMENT_COMPLETED: 'green',
};

interface RevenueTabProps {
  cycles: RevenueCycle[] | undefined;
  loadingCycles: boolean;
  selectedCycleId: number | null;
  onCycleChange: (val: number | null) => void;
  selectedCycle: RevenueCycle | undefined;
  cycleLocked: boolean;
  records: RevenueRecord[];
  totals: Record<string, number> | undefined;
  loadingRecords: boolean;
  isAdmin: boolean;
  // Actions
  onEditRecord: (record: RevenueRecord) => void;
  onApprove: (id: string) => void;
  onDeleteRecord: (id: string) => void;
  onScrapeRevenue: (cycleId: number) => void;
  scrapeLoading: boolean;
  onRefreshExchangeRate: () => void;
  refreshExchangeRateLoading: boolean;
  onLockCycle: (id: number) => void;
  lockLoading: boolean;
  onCompleteCycle: (id: number) => void;
  completeLoading: boolean;
  // Scrape data
  scrapeResults: YouTubeScrapeResult[] | undefined;
  scrapeHistory: YouTubeScrapeResult[] | undefined;
  scrapeHistoryLoading: boolean;
  historyKocId: string | null;
  onViewHistory: (kocId: string) => void;
  onCloseHistory: () => void;
  paymentStatus: any;
}

const RevenueTab: React.FC<RevenueTabProps> = ({
  cycles,
  loadingCycles,
  selectedCycleId,
  onCycleChange,
  selectedCycle,
  cycleLocked,
  records,
  totals,
  loadingRecords,
  isAdmin,
  onEditRecord,
  onApprove,
  onDeleteRecord,
  onScrapeRevenue,
  scrapeLoading,
  onRefreshExchangeRate,
  refreshExchangeRateLoading,
  onLockCycle,
  lockLoading,
  onCompleteCycle,
  completeLoading,
  scrapeResults,
  scrapeHistory,
  scrapeHistoryLoading,
  historyKocId,
  onViewHistory,
  onCloseHistory,
  paymentStatus,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ width: 220 }}
          placeholder={t('revenue.selectCycle')}
          loading={loadingCycles}
          value={selectedCycleId}
          onChange={(val) => onCycleChange(val)}
          options={cycles?.map((c) => ({
            value: c.id,
            label: `${c.month} - ${t(`status.${c.status}`, c.status)}`,
          }))}
          allowClear
        />
      </Space>

      {selectedCycleId && totals && (
        <SummaryBar
          items={[
            {
              title: t('revenue.total') + ' KOCs',
              value: records.length,
              prefix: <TeamOutlined />,
              valueStyle: { color: '#1677ff' },
            },
            {
              title: t('revenue.originalRevenue'),
              value: totals.totalOriginal || 0,
              prefix: <DollarOutlined />,
              precision: 2,
              valueStyle: { color: '#fa8c16' },
              formatter: (val) => formatUSD(Number(val)),
            },
            {
              title: t('revenue.kocReceiveUsd'),
              value: totals.totalKocUsd || 0,
              precision: 2,
              valueStyle: { color: '#52c41a' },
              formatter: (val) => formatUSD(Number(val)),
            },
            {
              title: t('revenue.kocReceiveVnd'),
              value: totals.totalKocVnd || 0,
              precision: 0,
              valueStyle: { color: '#722ed1' },
              formatter: (val) => formatVND(Number(val)),
            },
          ]}
          loading={loadingRecords}
        />
      )}

      {/* Cycle Info */}
      {selectedCycle && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Space size="large">
                <Text strong>
                  {t('revenue.month')}: {selectedCycle.month}
                </Text>
                <Space size="small">
                  <Text>
                    {t('revenue.exchangeRate')}:{' '}
                    <strong>{Number(selectedCycle.exchange_rate).toLocaleString()} VND/USD</strong>
                  </Text>
                  {!cycleLocked && (
                    <Tooltip title={t('cycle.fetchExchangeRate')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={onRefreshExchangeRate}
                        loading={refreshExchangeRateLoading}
                      />
                    </Tooltip>
                  )}
                </Space>
                <Tag color={statusColorMap[selectedCycle.status]}>
                  {t(`status.${selectedCycle.status}`, selectedCycle.status)}
                </Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                {!cycleLocked && (
                  <Tooltip title={t('revenue.updateRevenueHint')}>
                    <Button
                      type="primary"
                      icon={scrapeLoading ? <LoadingOutlined /> : <CloudSyncOutlined />}
                      onClick={() => onScrapeRevenue(selectedCycle.id)}
                      loading={scrapeLoading}
                    >
                      {t('revenue.updateRevenue')}
                    </Button>
                  </Tooltip>
                )}
                {isAdmin && selectedCycle.status === 'OPEN' && (
                  <Button
                    icon={<LockOutlined />}
                    onClick={() => onLockCycle(selectedCycle.id)}
                    loading={lockLoading}
                  >
                    {t('cycle.lock')}
                  </Button>
                )}
                {isAdmin && selectedCycle.status === 'LOCKED' && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => onCompleteCycle(selectedCycle.id)}
                    loading={completeLoading}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  >
                    {t('cycle.complete')}
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Revenue Table */}
      {selectedCycleId ? (
        <RevenueTable
          records={records}
          totals={totals}
          loading={loadingRecords}
          cycleLocked={cycleLocked}
          isAdmin={isAdmin}
          onEdit={onEditRecord}
          onApprove={onApprove}
          onDelete={onDeleteRecord}
          scrapeResults={scrapeResults}
          scrapeHistory={scrapeHistory}
          scrapeHistoryLoading={scrapeHistoryLoading}
          onViewHistory={onViewHistory}
          selectedHistoryKocId={historyKocId}
          onCloseHistory={onCloseHistory}
          paymentStatus={paymentStatus}
        />
      ) : (
        <Empty description={t('revenue.selectCycleFirst')} />
      )}
    </>
  );
};

export default RevenueTab;
