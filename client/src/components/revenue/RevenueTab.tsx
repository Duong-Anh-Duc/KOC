import {
    CheckCircleOutlined,
    CloudSyncOutlined,
    DollarOutlined,
    DownOutlined,
    LoadingOutlined,
    LockOutlined,
    TeamOutlined
} from '@ant-design/icons';
import { Button, Card, Checkbox, Col, Dropdown, Empty, Modal, Row, Select, Space, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaymentStatusMap, RevenueCycle, RevenueRecord, YouTubeScrapeResult } from '../../types';
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
  onScrapeRevenue: (cycleId: number, kocIds?: string[]) => void;
  scrapeLoading: boolean;

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
  paymentStatus?: PaymentStatusMap;
  activeKOCs?: Array<{ id: string; full_name: string; channel_name: string; base_rate: number }>;
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
  activeKOCs,
}) => {
  const { t } = useTranslation();
  const [selectKocModalOpen, setSelectKocModalOpen] = useState(false);
  const [selectedKocIds, setSelectedKocIds] = useState<string[]>([]);

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
              title: t('revenue.totalKOCs'),
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
              value: totals.totalKocReceiveUsd || 0,
              precision: 2,
              valueStyle: { color: '#1677ff' },
              formatter: (val) => formatUSD(Number(val)),
            },
            {
              title: t('revenue.kocReceiveVnd'),
              value: totals.totalKocReceiveVnd || 0,
              precision: 0,
              valueStyle: { color: '#52c41a' },
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
                    <strong>{Number(selectedCycle.exchange_rate).toLocaleString()} {t('common.vndUsd')}</strong>
                  </Text>
                </Space>
                <Tag color={statusColorMap[selectedCycle.status]}>
                  {t(`status.${selectedCycle.status}`, selectedCycle.status)}
                </Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                {!cycleLocked && (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'all',
                          label: t('revenue.scrapeAll', 'Cào tất cả KOC'),
                          icon: <CloudSyncOutlined />,
                          onClick: () => onScrapeRevenue(selectedCycle.id),
                        },
                        {
                          key: 'select',
                          label: t('revenue.scrapeSelected', 'Chọn KOC để cào'),
                          icon: <TeamOutlined />,
                          onClick: () => {
                            setSelectedKocIds([]);
                            setSelectKocModalOpen(true);
                          },
                        },
                      ],
                    }}
                    disabled={scrapeLoading}
                  >
                    <Button
                      type="primary"
                      icon={scrapeLoading ? <LoadingOutlined /> : <CloudSyncOutlined />}
                      loading={scrapeLoading}
                    >
                      {t('revenue.updateRevenue')} <DownOutlined />
                    </Button>
                  </Dropdown>
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

      {/* KOC Selection Modal */}
      <Modal
        title={t('revenue.scrapeSelected', 'Chọn KOC để cào')}
        open={selectKocModalOpen}
        onCancel={() => setSelectKocModalOpen(false)}
        onOk={() => {
          if (selectedCycle && selectedKocIds.length > 0) {
            onScrapeRevenue(selectedCycle.id, selectedKocIds);
            setSelectKocModalOpen(false);
          }
        }}
        okText={t('revenue.startScrape', 'Bắt đầu cào')}
        okButtonProps={{ disabled: selectedKocIds.length === 0 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Checkbox
            indeterminate={selectedKocIds.length > 0 && selectedKocIds.length < (activeKOCs?.length || 0)}
            checked={selectedKocIds.length > 0 && selectedKocIds.length === (activeKOCs?.length || 0)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedKocIds(activeKOCs?.map(k => k.id) || []);
              } else {
                setSelectedKocIds([]);
              }
            }}
          >
            {t('common.selectAll', 'Chọn tất cả')} ({activeKOCs?.length || 0})
          </Checkbox>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Checkbox.Group
            value={selectedKocIds}
            onChange={(vals) => setSelectedKocIds(vals as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {activeKOCs?.map(koc => (
              <Checkbox key={koc.id} value={koc.id}>
                <span style={{ fontWeight: 500 }}>{koc.full_name}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>({koc.channel_name})</span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      </Modal>
    </>
  );
};

export default RevenueTab;
