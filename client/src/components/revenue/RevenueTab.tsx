import {
    CalendarOutlined,
    CheckCircleOutlined,
    CloudSyncOutlined,
    DollarOutlined,
    DownOutlined,
    LoadingOutlined,
    LockOutlined,
    PlusOutlined,
    SafetyCertificateOutlined,
    TeamOutlined
} from '@ant-design/icons';
import { Button, Card, Checkbox, Col, Dropdown, Empty, List, Modal, Row, Select, Space, Tag, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
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
  onDeleteManyRecords: (ids: string[]) => void;
  onScrapeRevenue: (cycleId: number, kocIds?: string[]) => void;
  scrapeLoading: boolean;
  onScrapeMonthly: (kocIds?: string[]) => void;
  scrapeMonthlyLoading: boolean;
  onAddKocsToCycle: (cycleId: number, kocIds?: string[]) => void;
  addKocsLoading: boolean;
  onCheckPubCodes?: (cycleId: number) => void;
  checkPubCodesLoading?: boolean;

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
  onDeleteManyRecords,
  onScrapeRevenue,
  scrapeLoading,
  onScrapeMonthly,
  scrapeMonthlyLoading,
  onAddKocsToCycle,
  addKocsLoading,
  onCheckPubCodes,
  checkPubCodesLoading,

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

  // Modal: scrape monthly for selected KOCs
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [monthlySelectedIds, setMonthlySelectedIds] = useState<string[]>([]);

  // Modal: add KOCs to cycle
  const [addKocModalOpen, setAddKocModalOpen] = useState(false);
  const [addKocSelectedIds, setAddKocSelectedIds] = useState<string[]>([]);

  // KOCs not yet in the current cycle
  const existingKocIds = useMemo(() => new Set(records.map(r => r.koc_id)), [records]);
  const missingKOCs = useMemo(
    () => (activeKOCs || []).filter(k => !existingKocIds.has(k.id)),
    [activeKOCs, existingKocIds]
  );

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
                        { type: 'divider' },
                        {
                          key: 'monthly-all',
                          label: 'Cào tất cả dữ liệu tháng',
                          icon: <CalendarOutlined />,
                          onClick: () => onScrapeMonthly(),
                          disabled: scrapeMonthlyLoading,
                        },
                        {
                          key: 'monthly-select',
                          label: 'Chọn KOC cào dữ liệu tháng',
                          icon: <TeamOutlined />,
                          onClick: () => {
                            setMonthlySelectedIds(records.map(r => r.koc_id));
                            setMonthlyModalOpen(true);
                          },
                          disabled: scrapeMonthlyLoading,
                        },
                        { type: 'divider' },
                        {
                          key: 'check-pub-codes',
                          label: 'Kiểm tra Mã Pub toàn chu kỳ',
                          icon: <SafetyCertificateOutlined />,
                          onClick: () => selectedCycle && onCheckPubCodes?.(selectedCycle.id),
                          disabled: checkPubCodesLoading || !onCheckPubCodes,
                        },
                      ],
                    }}
                    disabled={scrapeLoading || scrapeMonthlyLoading || checkPubCodesLoading}
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
                {isAdmin && !cycleLocked && (
                  <Button
                    icon={addKocsLoading ? <LoadingOutlined /> : <PlusOutlined />}
                    loading={addKocsLoading}
                    onClick={() => {
                      setAddKocSelectedIds(missingKOCs.map(k => k.id));
                      setAddKocModalOpen(true);
                    }}
                    disabled={missingKOCs.length === 0}
                    title={missingKOCs.length === 0 ? 'Tất cả KOC đã có trong chu kỳ' : undefined}
                  >
                    Thêm KOC ({missingKOCs.length})
                  </Button>
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
          onDeleteMany={onDeleteManyRecords}
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

      {/* Scrape monthly for selected KOCs modal */}
      <Modal
        title={`Chọn KOC để cào dữ liệu tháng (${records.length} KOC trong chu kỳ)`}
        open={monthlyModalOpen}
        onCancel={() => setMonthlyModalOpen(false)}
        onOk={() => {
          if (monthlySelectedIds.length > 0) {
            onScrapeMonthly(monthlySelectedIds);
            setMonthlyModalOpen(false);
          }
        }}
        okText={`Cào ${monthlySelectedIds.length} KOC`}
        okButtonProps={{ disabled: monthlySelectedIds.length === 0, icon: <CalendarOutlined /> }}
      >
        <div style={{ marginBottom: 12 }}>
          <Checkbox
            indeterminate={monthlySelectedIds.length > 0 && monthlySelectedIds.length < records.length}
            checked={monthlySelectedIds.length === records.length && records.length > 0}
            onChange={(e) => setMonthlySelectedIds(e.target.checked ? records.map(r => r.koc_id) : [])}
          >
            Chọn tất cả ({records.length})
          </Checkbox>
        </div>
        <List
          size="small"
          style={{ maxHeight: 400, overflowY: 'auto' }}
          dataSource={records}
          renderItem={(record) => {
            const koc = activeKOCs?.find(k => k.id === record.koc_id);
            return (
              <List.Item style={{ padding: '4px 0' }}>
                <Checkbox
                  checked={monthlySelectedIds.includes(record.koc_id)}
                  onChange={(e) => {
                    setMonthlySelectedIds(prev =>
                      e.target.checked ? [...prev, record.koc_id] : prev.filter(id => id !== record.koc_id)
                    );
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{koc?.full_name || record.koc_id}</span>
                  <span style={{ color: '#888', marginLeft: 8 }}>({koc?.channel_name || ''})</span>
                </Checkbox>
              </List.Item>
            );
          }}
        />
      </Modal>

      {/* Add KOCs to cycle modal */}
      <Modal
        title={`Thêm KOC vào chu kỳ (${missingKOCs.length} KOC chưa có)`}
        open={addKocModalOpen}
        onCancel={() => setAddKocModalOpen(false)}
        onOk={() => {
          if (selectedCycle && addKocSelectedIds.length > 0) {
            onAddKocsToCycle(selectedCycle.id, addKocSelectedIds);
            setAddKocModalOpen(false);
          }
        }}
        okText={`Thêm ${addKocSelectedIds.length} KOC`}
        okButtonProps={{ disabled: addKocSelectedIds.length === 0 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Checkbox
            indeterminate={addKocSelectedIds.length > 0 && addKocSelectedIds.length < missingKOCs.length}
            checked={addKocSelectedIds.length === missingKOCs.length && missingKOCs.length > 0}
            onChange={(e) => setAddKocSelectedIds(e.target.checked ? missingKOCs.map(k => k.id) : [])}
          >
            Chọn tất cả ({missingKOCs.length})
          </Checkbox>
        </div>
        <List
          size="small"
          style={{ maxHeight: 400, overflowY: 'auto' }}
          dataSource={missingKOCs}
          renderItem={(koc) => (
            <List.Item style={{ padding: '4px 0' }}>
              <Checkbox
                checked={addKocSelectedIds.includes(koc.id)}
                onChange={(e) => {
                  setAddKocSelectedIds(prev =>
                    e.target.checked ? [...prev, koc.id] : prev.filter(id => id !== koc.id)
                  );
                }}
              >
                <span style={{ fontWeight: 500 }}>{koc.full_name}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>({koc.channel_name})</span>
              </Checkbox>
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
};

export default RevenueTab;
