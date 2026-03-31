import type { ProgressState } from '@/hooks/useProgress';
import {
    CalendarOutlined,
    DollarOutlined,
    PlusOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Space, Tabs, Typography, message } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProgress } from '../hooks/useProgress';
import { useTranslation } from 'react-i18next';
import { cycleApi, ytScraperApi } from '../api';
import { TaskProgressBar } from '../components/common';
import { RevenueRecordModal } from '../components/features';
import { CycleFormModal, CyclesTab, RevenueTab, ScrapeResultModal } from '../components/revenue';
import {
    useActiveKOCs,
    useAddKocsToCycle,
    useApproveRecord,
    useUnapproveRecord,
    useCompleteCycle,
    useCreateCycle,
    useCreateRevenueRecord,
    useCycles,
    useDeleteManyRecords,
    useDeleteRevenueRecord,
    useFetchExchangeRate,
    useLockCycle,
    useLockExchangeRate,
    useUnlockExchangeRate,
    usePaymentStatus,
    useReopenCycle,
    useRevenueRecords,
    useUpdateCycle,
    useUpdateExchangeRate,
    useUpdateRevenueRecord,
} from '../hooks';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../stores';
import type { RevenueCycle, RevenueRecord, YouTubeScrapeResult } from '../types';

const { Title } = Typography;

const RevenueControlPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const isViewer = user?.role === 'VIEWER';
  const { hasPermission } = usePermissions();
  const canManageCycle = isAdmin || hasPermission('manage_cycle');

  // Tab state
  const [activeTab, setActiveTab] = useState<string>('cycles');

  // Revenue records state
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RevenueRecord | null>(null);

  // Cycle management state
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<RevenueCycle | null>(null);
  const [cyclePageSize, setCyclePageSize] = useState(20);

  // Data
  const { data: cycles, isLoading: loadingCycles, refetch: refetchCycles } = useCycles();
  const { data: recordsData, isLoading: loadingRecords } = useRevenueRecords(selectedCycleId || 0);
  const { data: activeKOCsData } = useActiveKOCs();
  const { data: paymentStatus } = usePaymentStatus(selectedCycleId || 0);

  // Mutations
  const createCycleMutation = useCreateCycle();
  const updateCycleMutation = useUpdateCycle();
  const lockCycleMutation = useLockCycle();
  const reopenCycleMutation = useReopenCycle();
  const completeCycleMutation = useCompleteCycle();
  const lockExchangeRateMutation = useLockExchangeRate();
  const unlockExchangeRateMutation = useUnlockExchangeRate();
  const createRecordMutation = useCreateRevenueRecord();
  const updateRecordMutation = useUpdateRevenueRecord();
  const deleteRecordMutation = useDeleteRevenueRecord();
  const deleteManyMutation = useDeleteManyRecords();
  const approveMutation = useApproveRecord();
  const unapproveMutation = useUnapproveRecord();
  const fetchExchangeRateMutation = useFetchExchangeRate();
  const updateExchangeRateMutation = useUpdateExchangeRate();
  const addKocsMutation = useAddKocsToCycle();

  const queryClient = useQueryClient();

  // Monthly scrape-all with SSE progress
  const { state: monthlyProgress, startTask: startMonthlyTask, reset: resetMonthlyProgress } = useProgress(() => {
    queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
    message.success('Đã cào xong dữ liệu tháng, doanh thu gốc đã được cập nhật');
  });

  const { state: pubCodeProgress, startTask: startPubCodeTask, reset: resetPubCodeProgress } = useProgress(() => {
    queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
    message.success('Đã kiểm tra xong mã Pub cho toàn chu kỳ');
  });

  const scrapeMonthlyMutation = useMutation({
    mutationFn: (kocIds?: string[]) => ytScraperApi.scrapeAllMonthlyRevenue(kocIds),
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) { resetMonthlyProgress(); startMonthlyTask(taskId); }
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Cào dữ liệu tháng thất bại');
    },
  });

  // Batch scrape progress state (replaces SSE useProgress hook)
  const EMPTY_PROGRESS: ProgressState = { taskId: null, active: false, progress: null, completed: false, result: null, error: null };
  const [batchProgress, setBatchProgress] = useState<ProgressState>(EMPTY_PROGRESS);

  // Scrape result modal
  const [scrapeResultOpen, setScrapeResultOpen] = useState(false);
  const [scrapeResultData, setScrapeResultData] = useState<any>(null);


  // Scrape detail data (for country breakdown + history)
  const { data: scrapeResults } = useQuery({
    queryKey: ['yt-scrape-latest-results'],
    queryFn: async () => {
      const res = await ytScraperApi.getLatestResults();
      return (res.data?.data || []) as YouTubeScrapeResult[];
    },
  });
  const [historyKocId, setHistoryKocId] = useState<string | null>(null);
  const { data: scrapeHistory, isLoading: scrapeHistoryLoading } = useQuery({
    queryKey: ['yt-scrape-history', historyKocId],
    queryFn: async () => {
      if (!historyKocId) return [];
      const res = await ytScraperApi.getKOCHistory(historyKocId, 20);
      return (res.data?.data || []) as YouTubeScrapeResult[];
    },
    enabled: !!historyKocId,
  });

  const selectedCycle = cycles?.find((c) => c.id === selectedCycleId);
  const cycleLocked = selectedCycle?.status !== 'OPEN';
  const records = recordsData?.data || [];
  const totals = (recordsData as unknown as { totals?: Record<string, number> })?.totals;
  const activeKOCs = activeKOCsData?.data || [];

  const [cycleForm] = Form.useForm();
  const cycleModalOpenRef = useRef(false);

  // Silent background exchange rate update every 5 minutes (no spinner)
  const silentFetchExchangeRate = useCallback(async () => {
    try {
      const res = await cycleApi.getExchangeRate();
      const rate = res.data?.data?.averageRate;
      if (rate && cycleModalOpenRef.current) {
        cycleForm.setFieldsValue({ exchange_rate: rate });
      }
    } catch {
      // silent - ignore errors
    }
  }, [cycleForm]);

  useEffect(() => {
    const interval = setInterval(silentFetchExchangeRate, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [silentFetchExchangeRate]);

  // --- Cycle handlers ---
  const openCreateCycle = () => {
    setEditingCycle(null);
    cycleForm.resetFields();
    setCycleModalOpen(true);
    cycleModalOpenRef.current = true;
  };

  const openEditCycle = (cycle: RevenueCycle) => {
    setEditingCycle(cycle);
    cycleForm.setFieldsValue({
      month: cycle.month,
      exchange_rate: Number(cycle.exchange_rate),
    });
    setCycleModalOpen(true);
    cycleModalOpenRef.current = true;
  };

  const handleCycleSubmit = (values: { month: string; exchange_rate: number }) => {
    if (editingCycle) {
      updateCycleMutation.mutate(
        { id: editingCycle.id, data: values },
        { onSuccess: () => setCycleModalOpen(false) }
      );
    } else {
      createCycleMutation.mutate(values, {
        onSuccess: () => setCycleModalOpen(false),
      });
    }
  };

  const handleCycleClick = (cycle: RevenueCycle) => {
    setSelectedCycleId(cycle.id);
    setActiveTab('revenue');
  };

  const handleScrapeRevenue = useCallback(async (cycleId: number, kocIds?: string[]) => {
    const ids = kocIds ?? activeKOCs.map((k) => k.id);
    if (ids.length === 0) return;

    setBatchProgress({ taskId: null, active: true, progress: { step: 0, total: ids.length, percent: 0, message: 'Chuẩn bị...' }, completed: false, result: null, error: null });
    const apiBase = import.meta.env.VITE_API_URL || '/api';

    try {
      const res = await cycleApi.scrapeRevenue(cycleId, ids);
      const taskId: string | undefined = res.data?.data?.taskId;
      if (!taskId) throw new Error('No taskId returned');

      const result = await new Promise<any>((resolve, reject) => {
        const url = `${apiBase}/progress/${taskId}`;
        const es = new EventSource(url);
        const timer = setTimeout(() => { es.close(); reject(new Error('TIMEOUT')); }, 600000);
        es.addEventListener('progress', (event: MessageEvent) => {
          try {
            const d = JSON.parse(event.data);
            setBatchProgress((prev) => ({
              ...prev,
              progress: { step: d.step ?? 0, total: d.total ?? ids.length, percent: d.percent ?? 0, message: d.message ?? '' },
            }));
          } catch { /* ignore */ }
        });
        es.addEventListener('complete', (event: MessageEvent) => {
          clearTimeout(timer); es.close();
          try { const d = JSON.parse(event.data); resolve(d?.result ?? d); }
          catch { resolve(null); }
        });
        es.addEventListener('error', () => { clearTimeout(timer); es.close(); reject(new Error('SSE error')); });
      });

      setBatchProgress({ taskId: null, active: false, progress: { step: ids.length, total: ids.length, percent: 100, message: 'Hoàn thành!' }, completed: true, result, error: null });
      setScrapeResultData(result);
      setScrapeResultOpen(true);
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      setBatchProgress((prev) => ({ ...prev, active: false, completed: true, error: msg }));
      message.error(`Lỗi cào doanh thu: ${msg}`);
    }
  }, [activeKOCs, queryClient]);

  const handleCheckPubCodes = useCallback(async (cycleId: number) => {
    try {
      const res = await cycleApi.checkPubCodes(cycleId);
      const taskId = res.data?.data?.taskId;
      if (taskId) { resetPubCodeProgress(); startPubCodeTask(taskId); }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Kiểm tra mã Pub thất bại');
    }
  }, [resetPubCodeProgress, startPubCodeTask]);

  const handleCreateRecord = (values: { koc_id: string; original_revenue_usd: number; us_tax_deduction: number }) => {
    if (editingRecord) {
      updateRecordMutation.mutate(
        {
          id: editingRecord.id,
          data: {
            original_revenue_usd: values.original_revenue_usd,
            us_tax_deduction: values.us_tax_deduction,
          },
        },
        { onSuccess: () => { setRecordModalOpen(false); setEditingRecord(null); } }
      );
    } else {
      createRecordMutation.mutate(
        { ...values, cycle_id: selectedCycleId! },
        { onSuccess: () => setRecordModalOpen(false) }
      );
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>{t('menu.revenue')}</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetchCycles()} />
            {canManageCycle && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCycle}>
                {t('cycle.create')}
              </Button>
            )}
          </Space>
        </div>

        {/* Batch scrape progress overlay */}
        <TaskProgressBar state={batchProgress} onDismiss={() => setBatchProgress((p) => ({ ...p, active: false, completed: false }))} />

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'cycles',
              label: (
                <span><CalendarOutlined style={{ marginRight: 6 }} />{t('menu.cycles')}</span>
              ),
              children: (
                <CyclesTab
                  cycles={cycles}
                  loading={loadingCycles}
                  canManageCycle={canManageCycle}
                  pageSize={cyclePageSize}
                  onPageSizeChange={setCyclePageSize}
                  onCycleClick={handleCycleClick}
                  onEditCycle={openEditCycle}
                  onLockCycle={(id) => lockCycleMutation.mutate(id)}
                  lockLoading={lockCycleMutation.isPending}
                  onReopenCycle={(id) => reopenCycleMutation.mutate(id)}
                  reopenLoading={reopenCycleMutation.isPending}
                  onCompleteCycle={(id) => completeCycleMutation.mutate(id)}
                  completeLoading={completeCycleMutation.isPending}
                  onLockExchangeRate={(id) => lockExchangeRateMutation.mutate(id)}
                  onUnlockExchangeRate={(id) => unlockExchangeRateMutation.mutate(id)}
                  lockExchangeRateLoading={lockExchangeRateMutation.isPending || unlockExchangeRateMutation.isPending}
                />
              ),
            },
            {
              key: 'revenue',
              label: (
                <span><DollarOutlined style={{ marginRight: 6 }} />{t('revenue.records')}</span>
              ),
              children: (
                <>
                  <TaskProgressBar state={monthlyProgress} onDismiss={resetMonthlyProgress} />
                  <TaskProgressBar state={pubCodeProgress} onDismiss={resetPubCodeProgress} />
                  <RevenueTab
                  cycles={cycles}
                  loadingCycles={loadingCycles}
                  selectedCycleId={selectedCycleId}
                  onCycleChange={setSelectedCycleId}
                  selectedCycle={selectedCycle}
                  cycleLocked={cycleLocked}
                  records={records}
                  totals={totals}
                  loadingRecords={loadingRecords}
                  isAdmin={isAdmin}
                  canManageCycle={canManageCycle}
                  canRunScraper={isAdmin || hasPermission('run_scraper')}
                  canApprove={isAdmin || hasPermission('approve_revenue')}
                  canDelete={isAdmin || hasPermission('delete_revenue')}
                  onEditRecord={(record) => { setEditingRecord(record); setRecordModalOpen(true); }}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onUnapprove={(id) => unapproveMutation.mutate(id)}
                  onDeleteRecord={(id) => deleteRecordMutation.mutate(id)}
                  onDeleteManyRecords={(ids) => deleteManyMutation.mutate(ids)}
                  onScrapeRevenue={handleScrapeRevenue}
                  scrapeLoading={batchProgress.active}
                  onScrapeMonthly={(kocIds) => scrapeMonthlyMutation.mutate(kocIds)}
                  scrapeMonthlyLoading={scrapeMonthlyMutation.isPending || monthlyProgress.active}
                  onAddKocsToCycle={(cycleId, kocIds) => addKocsMutation.mutate({ cycleId, kocIds })}
                  addKocsLoading={addKocsMutation.isPending}
                  onCheckPubCodes={handleCheckPubCodes}
                  checkPubCodesLoading={pubCodeProgress.active}
                  onLockCycle={(id) => lockCycleMutation.mutate(id)}
                  lockLoading={lockCycleMutation.isPending}
                  onCompleteCycle={(id) => completeCycleMutation.mutate(id)}
                  completeLoading={completeCycleMutation.isPending}
                  scrapeResults={scrapeResults}
                  scrapeHistory={scrapeHistory}
                  scrapeHistoryLoading={scrapeHistoryLoading}
                  historyKocId={historyKocId}
                  onViewHistory={(kocId) => setHistoryKocId(kocId)}
                  onCloseHistory={() => setHistoryKocId(null)}
                  paymentStatus={paymentStatus}
                  activeKOCs={activeKOCs}
                  readOnly={!isAdmin && !hasPermission('edit_revenue')}
                  />
                </>
              ),
            },
          ]}
        />

        <RevenueRecordModal
          open={recordModalOpen}
          editingRecord={editingRecord}
          activeKOCs={activeKOCs}
          cycleId={selectedCycleId || 0}
          onCancel={() => { setRecordModalOpen(false); setEditingRecord(null); }}
          onSubmit={handleCreateRecord}
          loading={createRecordMutation.isPending || updateRecordMutation.isPending}
        />

        <CycleFormModal
          open={cycleModalOpen}
          editingCycle={editingCycle}
          form={cycleForm}
          cycles={cycles || []}
          onCancel={() => { setCycleModalOpen(false); cycleModalOpenRef.current = false; }}
          onSubmit={(values) => { handleCycleSubmit(values); cycleModalOpenRef.current = false; }}
          confirmLoading={createCycleMutation.isPending || updateCycleMutation.isPending}
        />

        <ScrapeResultModal
          open={scrapeResultOpen}
          data={scrapeResultData}
          onClose={() => setScrapeResultOpen(false)}
        />
      </div>
  );
};

export default RevenueControlPage;
