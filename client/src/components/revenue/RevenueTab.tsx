import { Empty, Select, Space } from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaymentStatusMap, RevenueCycle, RevenueRecord, YouTubeScrapeResult } from '../../types';
import { RevenueTable } from '../features';
import AddKocModal from './AddKocModal';
import GemLoginScrapeModal from './GemLoginScrapeModal';
import RevenueSummary from './RevenueSummary';
import RevenueToolbar from './RevenueToolbar';
import ScrapeMonthlyModal from './ScrapeMonthlyModal';
import SelectKocModal from './SelectKocModal';

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
  canManageCycle: boolean;
  canRunScraper: boolean;
  canApprove: boolean;
  canDelete: boolean;
  // Actions
  onEditRecord: (record: RevenueRecord) => void;
  onApprove: (id: string) => void;
  onUnapprove: (id: string) => void;
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
  readOnly?: boolean;
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
  canManageCycle,
  canRunScraper,
  canApprove,
  canDelete,
  onEditRecord,
  onApprove,
  onUnapprove,
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
  readOnly,
}) => {
  const { t } = useTranslation();
  const [selectKocModalOpen, setSelectKocModalOpen] = useState(false);
  const [selectedKocIds, setSelectedKocIds] = useState<string[]>([]);
  const [gemLoginSelectOpen, setGemLoginSelectOpen] = useState(false);
  const [gemLoginSelectedIds, setGemLoginSelectedIds] = useState<string[]>([]);

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
        <RevenueSummary
          records={records}
          totals={totals}
          loading={loadingRecords}
        />
      )}

      {/* Cycle Info & Actions */}
      {selectedCycle && !readOnly && (
        <RevenueToolbar
          selectedCycle={selectedCycle}
          cycleLocked={cycleLocked}
          records={records}
          isAdmin={isAdmin}
          canManageCycle={canManageCycle}
          canRunScraper={canRunScraper}
          onScrapeRevenue={onScrapeRevenue}
          scrapeLoading={scrapeLoading}
          onScrapeMonthly={onScrapeMonthly}
          scrapeMonthlyLoading={scrapeMonthlyLoading}
          onCheckPubCodes={onCheckPubCodes}
          checkPubCodesLoading={checkPubCodesLoading}
          onLockCycle={onLockCycle}
          lockLoading={lockLoading}
          onCompleteCycle={onCompleteCycle}
          completeLoading={completeLoading}
          addKocsLoading={addKocsLoading}
          missingKOCsCount={missingKOCs.length}
          onOpenGemLoginSelect={() => {
            setGemLoginSelectedIds(records.map(r => r.koc_id));
            setGemLoginSelectOpen(true);
          }}
          onOpenMonthlyModal={() => {
            setMonthlySelectedIds(records.map(r => r.koc_id));
            setMonthlyModalOpen(true);
          }}
          onOpenAddKocModal={() => {
            setAddKocSelectedIds(missingKOCs.map(k => k.id));
            setAddKocModalOpen(true);
          }}
        />
      )}

      {/* Revenue Table */}
      {selectedCycleId ? (
        <RevenueTable
          records={records}
          totals={totals}
          loading={loadingRecords}
          cycleLocked={cycleLocked}
          isAdmin={isAdmin}
          canApprove={canApprove}
          canDelete={canDelete}
          onEdit={readOnly ? undefined : onEditRecord}
          onApprove={onApprove}
          onUnapprove={onUnapprove}
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

      {/* Modals */}
      <SelectKocModal
        open={selectKocModalOpen}
        onCancel={() => setSelectKocModalOpen(false)}
        selectedKocIds={selectedKocIds}
        setSelectedKocIds={setSelectedKocIds}
        activeKOCs={activeKOCs}
        onConfirm={(kocIds) => {
          if (selectedCycle) {
            onScrapeRevenue(selectedCycle.id, kocIds);
          }
        }}
      />

      <ScrapeMonthlyModal
        open={monthlyModalOpen}
        onCancel={() => setMonthlyModalOpen(false)}
        monthlySelectedIds={monthlySelectedIds}
        setMonthlySelectedIds={setMonthlySelectedIds}
        records={records}
        activeKOCs={activeKOCs}
        onConfirm={(kocIds) => onScrapeMonthly(kocIds)}
      />

      <AddKocModal
        open={addKocModalOpen}
        onCancel={() => setAddKocModalOpen(false)}
        addKocSelectedIds={addKocSelectedIds}
        setAddKocSelectedIds={setAddKocSelectedIds}
        missingKOCs={missingKOCs}
        onConfirm={(kocIds) => {
          if (selectedCycle) {
            onAddKocsToCycle(selectedCycle.id, kocIds);
          }
        }}
      />

      <GemLoginScrapeModal
        open={gemLoginSelectOpen}
        onCancel={() => setGemLoginSelectOpen(false)}
        gemLoginSelectedIds={gemLoginSelectedIds}
        setGemLoginSelectedIds={setGemLoginSelectedIds}
        records={records}
        selectedCycle={selectedCycle}
        onConfirm={(cycleId, kocIds) => onScrapeRevenue(cycleId, kocIds)}
      />
    </>
  );
};

export default RevenueTab;
