import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statsApi } from '../api';
import { SummaryBar, TaskProgressBar } from '../components/common';
import { StatsDetailModal, StatsGrowthTable, StatsHeader, Top10Chart } from '../components/stats';
import { useProgress } from '../hooks/useProgress';
import { toastError } from '../utils';

/** Format large numbers: 6900000 → "6.9M", 31600 → "31.6K" */
const formatNumber = (val: number | null | undefined): string => {
  if (val == null || val === 0) return '-';
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return val.toLocaleString();
};

const StatsPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedKOC, setSelectedKOC] = useState<string | undefined>();

  const { data: allGrowthData, isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['stats-growth-all'],
    queryFn: async () => {
      const res = await statsApi.getAllGrowth();
      return res.data;
    },
  });

  // Fetch detail data when a KOC is selected
  const { data: detailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['stats-detail', selectedKOC],
    queryFn: async () => {
      if (!selectedKOC) return null;
      const res = await statsApi.getGrowth(selectedKOC);
      return res.data;
    },
    enabled: !!selectedKOC,
  });

  // SSE progress for fetch all stats
  const statsProgress = useProgress((result: unknown) => {
    const data = result as { success?: number; failed?: number } | null;
    if (data) {
      refetchAll();
    }
  });

  const fetchAllStatsMutation = useMutation({
    mutationFn: async () => {
      const res = await statsApi.fetchAllStats();
      return res;
    },
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) {
        statsProgress.startTask(taskId);
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || t('stats.fetchError');
      toastError('statsFetchError', message);
    },
  });

  const handleFetchAll = () => {
    fetchAllStatsMutation.mutate();
  };

  const growthList = allGrowthData?.data || [];
  const selectedKOCData = growthList.find((k: any) => k.koc_id === selectedKOC);

  const totalViews28d = growthList.reduce((sum: number, item: any) => sum + (item.views_28d_num || 0), 0);
  const totalSubsGained = growthList.reduce((sum: number, item: any) => sum + (item.subs_gained_28d_num || 0), 0);
  const avgRevenue = growthList.length > 0
    ? growthList.reduce((sum: number, item: any) => sum + (item.estimated_revenue_28d_num || 0), 0) / growthList.length
    : 0;
  const topKOCs = [...growthList].sort((a: any, b: any) => (b.views_28d_num || 0) - (a.views_28d_num || 0)).slice(0, 10);

  const detailData = detailResponse?.data || null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <TaskProgressBar state={statsProgress.state} onDismiss={statsProgress.reset} />

      <StatsHeader
        onRefresh={() => refetchAll()}
        onFetchAll={handleFetchAll}
        fetchLoading={fetchAllStatsMutation.isPending || statsProgress.state.active}
      />

        <SummaryBar
          items={[
            {
              title: t('dashboard.totalKOCs'),
              value: growthList.length,
              valueStyle: { color: '#1677ff' },
            },
            {
              title: t('stats.totalViews28d'),
              value: formatNumber(totalViews28d),
              valueStyle: { color: '#52c41a' },
            },
            {
              title: t('stats.totalSubs28d'),
              value: totalSubsGained > 0 ? '+' + formatNumber(totalSubsGained) : formatNumber(totalSubsGained),
              valueStyle: { color: '#fa8c16' },
            },
            {
              title: t('stats.avgRevenue28d'),
              value: `$${avgRevenue.toFixed(2)}`,
              valueStyle: { color: '#faad14' },
            },
          ]}
          loading={allLoading}
        />

        <Top10Chart topKOCs={topKOCs} loading={allLoading} />

        <StatsGrowthTable
          growthList={growthList}
          loading={allLoading}
          onViewKOC={(kocId: React.SetStateAction<string | undefined>) => setSelectedKOC(kocId)}
        />

        <StatsDetailModal
          open={!!selectedKOC && !!selectedKOCData?.has_data}
          channelName={selectedKOCData?.channel_name || ''}
          detailData={detailData ? {
            byCountry: detailData.byCountry,
            byDay: detailData.byDay,
          } : null}
          loading={detailLoading}
          onClose={() => setSelectedKOC(undefined)}
        />
      </div>
  );
};

export default StatsPage;
