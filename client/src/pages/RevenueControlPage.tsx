import { useProgress } from '@/hooks/useProgress';
import {
  CalendarOutlined,
  DollarOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Space, Tabs, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cycleApi, ytScraperApi } from '../api';
import { TaskProgressBar } from '../components/common';
import { RevenueRecordModal } from '../components/features';
import { CycleFormModal, CyclesTab, RevenueTab, ScrapeResultModal } from '../components/revenue';
import {
  useActiveKOCs,
  useApproveRecord,
  useCompleteCycle,
  useCreateCycle,
  useCreateRevenueRecord,
  useCycles,
  useDeleteRevenueRecord,
  useFetchExchangeRate,
  useLockCycle,
  usePaymentStatus,
  useRevenueRecords,
  useScrapeRevenue,
  useUpdateCycle,
  useUpdateExchangeRate,
  useUpdateRevenueRecord,
} from '../hooks';
import { useAuthStore } from '../stores';
import type { RevenueCycle, RevenueRecord, YouTubeScrapeResult } from '../types';

const { Title } = Typography;

const RevenueControlPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

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
  const completeCycleMutation = useCompleteCycle();
  const createRecordMutation = useCreateRevenueRecord();
  const updateRecordMutation = useUpdateRevenueRecord();
  const deleteRecordMutation = useDeleteRevenueRecord();
  const approveMutation = useApproveRecord();
  const fetchExchangeRateMutation = useFetchExchangeRate();
  const scrapeRevenueMutation = useScrapeRevenue();
  const updateExchangeRateMutation = useUpdateExchangeRate();

  // SSE Progress for scrape revenue
  const queryClient = useQueryClient();
  const scrapeProgress = useProgress((result: unknown) => {
    // When scrape completes, show result and refresh data
    setScrapeResultData(result);
    setScrapeResultOpen(true);
    queryClient.invalidateQueries({ queryKey: ['cycles'] });
    queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
  });

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

  const handleScrapeRevenue = (cycleId: number) => {
    scrapeRevenueMutation.mutate(cycleId, {
      onSuccess: (res) => {
        const taskId = res.data?.data?.taskId;
        if (taskId) {
          scrapeProgress.startTask(taskId);
        }
      },
    });
  };

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
            {false && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCycle}>
                {t('cycle.create')}
              </Button>
            )}
          </Space>
        </div>

        {/* SSE Progress Bar for scrape revenue */}
        <TaskProgressBar state={scrapeProgress.state} onDismiss={scrapeProgress.reset} />

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
                  isAdmin={isAdmin}
                  pageSize={cyclePageSize}
                  onPageSizeChange={setCyclePageSize}
                  onCycleClick={handleCycleClick}
                  onEditCycle={openEditCycle}
                  onLockCycle={(id) => lockCycleMutation.mutate(id)}
                  lockLoading={lockCycleMutation.isPending}
                  onCompleteCycle={(id) => completeCycleMutation.mutate(id)}
                  completeLoading={completeCycleMutation.isPending}
                />
              ),
            },
            {
              key: 'revenue',
              label: (
                <span><DollarOutlined style={{ marginRight: 6 }} />{t('revenue.records')}</span>
              ),
              children: (
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
                  onEditRecord={(record) => { setEditingRecord(record); setRecordModalOpen(true); }}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onDeleteRecord={(id) => deleteRecordMutation.mutate(id)}
                  onScrapeRevenue={handleScrapeRevenue}
                  scrapeLoading={scrapeRevenueMutation.isPending || scrapeProgress.state.active}
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
                />
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
