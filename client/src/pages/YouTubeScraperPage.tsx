import {
    LineChartOutlined,
    LinkOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, message, notification, Space, Spin, Tooltip, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cycleApi, ytScraperApi } from '../api';
import { TaskProgressBar } from '../components/common';
import { useProgress } from '../hooks/useProgress';
import {
    CreateRevenueBar,
    CreateRevenueResultModal,
    LatestResultsTable,
    LoginStatusCard,
    ScrapeHistoryDrawer,
} from '../components/ytScraper';
import type { RevenueCycle, YouTubeScrapeResult } from '../types';

const { Title } = Typography;

const YouTubeScraperPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);
  const [waitingForLogin, setWaitingForLogin] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [asyncJobStatus, setAsyncJobStatus] = useState<'pending' | 'running' | 'completed' | 'failed' | null>(null);

  // Revenue records creation state
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [createRevenueResultOpen, setCreateRevenueResultOpen] = useState(false);
  const [createRevenueResultData, setCreateRevenueResultData] = useState<any>(null);

  // Fetch open cycles
  const { data: cyclesData } = useQuery({
    queryKey: ['cycles-for-scraper'],
    queryFn: async () => {
      const res = await cycleApi.getAll();
      return (res.data?.data || []) as RevenueCycle[];
    },
  });

  // Check login status — poll every 3s while waiting for user to log in
  const [loginBrowserOpen, setLoginBrowserOpen] = React.useState(false);
  const {
    data: statusData,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['yt-scraper-status'],
    queryFn: async () => {
      // Extra: when login is confirmed, clear vncUrl and stop waiting
      const res = await ytScraperApi.checkStatus();
      const data = res.data?.data;
      setLoginBrowserOpen(!!data?.loginBrowserOpen);
      if (data?.loggedIn && waitingForLogin) {
        setWaitingForLogin(false);
        setVncUrl(null);
        notification.destroy('vnc-login');
        message.success(t('ytScraper.loginSuccess'));
      }
      return data;
    },
    retry: false,
    refetchInterval: (waitingForLogin || loginBrowserOpen) ? 3000 : false,
  });

  // Auto-connect on first load
  useQuery({
    queryKey: ['yt-scraper-auto-connect'],
    queryFn: async () => {
      const res = await ytScraperApi.autoConnect();
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      }
      return res.data?.data;
    },
    retry: false,
  });

  const isLoggedIn = statusData?.loggedIn ?? false;

  // Fetch latest scrape results from database
  const {
    data: latestResults,
    isLoading: latestLoading,
    refetch: refetchLatest,
  } = useQuery({
    queryKey: ['yt-scrape-latest-results'],
    queryFn: async () => {
      const res = await ytScraperApi.getLatestResults();
      return (res.data?.data || []) as YouTubeScrapeResult[];
    },
  });

  // Fetch scrape history for a specific KOC
  const [selectedKocId, setSelectedKocId] = useState<string | null>(null);
  const { data: kocHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['yt-scrape-history', selectedKocId],
    queryFn: async () => {
      if (!selectedKocId) return [];
      const res = await ytScraperApi.getKOCHistory(selectedKocId, 20);
      return (res.data?.data || []) as YouTubeScrapeResult[];
    },
    enabled: !!selectedKocId,
  });

  // Open login browser — then poll status until logged in
  const openLoginMutation = useMutation({
    mutationFn: () => ytScraperApi.openLogin(),
    onSuccess: (res) => {
      const url = (res.data?.data as any)?.vncUrl as string | undefined;
      const vncLink = url || 'http://46.62.170.132:6080/vnc.html';
      setVncUrl(vncLink);
      setWaitingForLogin(true);
      notification.open({
        key: 'vnc-login',
        message: t('ytScraper.vncBrowserOpened'),
        description: t('ytScraper.vncLoginDesc'),
        duration: 0,
        btn: (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => { window.open(vncLink, '_blank', 'noopener,noreferrer'); notification.destroy('vnc-login'); }}
          >
            {t('ytScraper.openLoginPage')}
          </Button>
        ),
      });
    },
    onError: () => {
      message.error(t('ytScraper.loginBrowserError'));
      setWaitingForLogin(false);
    },
  });

  // Reset session then re-open login browser (change account)
  const changeAccountMutation = useMutation({
    mutationFn: async () => {
      await ytScraperApi.resetSession();
      const res = await ytScraperApi.openLogin();
      return res;
    },
    onSuccess: (res) => {
      const url = (res.data?.data as any)?.vncUrl as string | undefined;
      const vncLink = url || 'http://46.62.170.132:6080/vnc.html';
      setVncUrl(vncLink);
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      setWaitingForLogin(true);
      notification.open({
        key: 'vnc-login',
        message: t('ytScraper.vncBrowserOpened'),
        description: t('ytScraper.vncLoginDesc'),
        duration: 0,
        btn: (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => { window.open(vncLink, '_blank', 'noopener,noreferrer'); notification.destroy('vnc-login'); }}
          >
            {t('ytScraper.openLoginPage')}
          </Button>
        ),
      });
    },
    onError: () => {
      message.error(t('ytScraper.resetSessionError'));
      setWaitingForLogin(false);
    },
  });

  // Refresh connected account info (channel name + email)
  const refreshAccountInfoMutation = useMutation({
    mutationFn: () => ytScraperApi.refreshAccountInfo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: () => {
      message.error(t('ytScraper.resetSessionError'));
    },
  });

  // Create revenue records from latest scraped data
  const createRevenueRecordsMutation = useMutation({
    mutationFn: (cycleId: number) => ytScraperApi.createRevenueRecords(cycleId),
    onSuccess: (res) => {
      const data = res.data?.data;
      setCreateRevenueResultData(data);
      setCreateRevenueResultOpen(true);
      message.success(t('ytScraper.revenueRecordsCreated', { count: data?.summary?.recordsCreated || 0 }));
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || error.message);
    },
  });

  // Scrape all KOCs (async - non-blocking)
  const scrapeAllAsyncMutation = useMutation({
    mutationFn: () => ytScraperApi.scrapeAllAsync(),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.jobId) {
        setAsyncJobId(data.jobId);
        setAsyncJobStatus('pending');
        message.success(t('ytScraper.scrapeStartedBackground', { count: data.channelCount }));
        pollJobStatus(data.jobId);
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error.message;
      message.error(msg);
    },
  });

  // Poll job status
  const pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await ytScraperApi.getJobStatus(jobId);
        const job = res.data?.data;
        if (job) {
          setAsyncJobStatus(job.status);
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval);
            if (job.status === 'completed') {
              message.success(t('ytScraper.scrapeCompleted'));
              refetchLatest();
            } else {
              message.error(t('ytScraper.scrapeFailed'));
            }
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);
  };

  // Monthly scrape-all with SSE progress
  const { state: monthlyProgress, startTask: startMonthlyTask, reset: resetMonthlyProgress } = useProgress(() => {
    queryClient.invalidateQueries({ queryKey: ['monthlyRevenue'] });
    queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
    message.success('Đã cào xong dữ liệu tháng cho tất cả KOC');
  });

  const scrapeAllMonthlyMutation = useMutation({
    mutationFn: () => ytScraperApi.scrapeAllMonthlyRevenue(),
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) startMonthlyTask(taskId);
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Cào dữ liệu tháng thất bại');
    },
  });

  const isScraping = scrapeAllAsyncMutation.isPending || asyncJobStatus === 'running' || asyncJobStatus === 'pending';

  return (
    <Spin spinning={isScraping} tip={t('ytScraper.scrapingAll')} size="large" className="stats-page-spin">
      <div>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 8 }} />
            {t('ytScraper.title')}
          </Title>
          <Space>
            <Tooltip title={t('ytScraper.refreshStatus')}>
              <Button icon={<ReloadOutlined />} onClick={() => refetchStatus()} loading={statusLoading} />
            </Tooltip>
          </Space>
        </div>

        <LoginStatusCard
          statusData={statusData}
          statusLoading={statusLoading}
          isLoggedIn={isLoggedIn}
          waitingForLogin={waitingForLogin}
          vncUrl={vncUrl}
          onOpenLogin={() => openLoginMutation.mutate()}
          openLoginLoading={openLoginMutation.isPending}
          onChangeAccount={() => changeAccountMutation.mutate()}
          changeAccountLoading={changeAccountMutation.isPending}
          onRefreshAccountInfo={() => refreshAccountInfoMutation.mutate()}
          refreshAccountInfoLoading={refreshAccountInfoMutation.isPending}
        />

        <CreateRevenueBar
          cyclesData={cyclesData}
          selectedCycleId={selectedCycleId}
          onCycleChange={setSelectedCycleId}
          onCreateRecords={() => selectedCycleId && createRevenueRecordsMutation.mutate(selectedCycleId)}
          createLoading={createRevenueRecordsMutation.isPending}
          disabled={!selectedCycleId || !latestResults || latestResults.length === 0}
        />

        <TaskProgressBar state={monthlyProgress} onDismiss={resetMonthlyProgress} />

        <LatestResultsTable
          latestResults={latestResults}
          latestLoading={latestLoading}
          isLoggedIn={isLoggedIn}
          asyncJobStatus={asyncJobStatus}
          scrapeAllLoading={scrapeAllAsyncMutation.isPending || asyncJobStatus === 'running'}
          onScrapeAll={() => {
            setAsyncJobId(null);
            setAsyncJobStatus(null);
            scrapeAllAsyncMutation.mutate();
          }}
          onRefresh={() => refetchLatest()}
          onViewHistory={(kocId) => setSelectedKocId(kocId)}
          scrapeAllMonthlyLoading={scrapeAllMonthlyMutation.isPending || monthlyProgress.active}
          onScrapeAllMonthly={() => {
            resetMonthlyProgress();
            scrapeAllMonthlyMutation.mutate();
          }}
        />

        <ScrapeHistoryDrawer
          selectedKocId={selectedKocId}
          kocHistory={kocHistory}
          historyLoading={historyLoading}
          onClose={() => setSelectedKocId(null)}
        />

        <CreateRevenueResultModal
          open={createRevenueResultOpen}
          data={createRevenueResultData}
          onClose={() => setCreateRevenueResultOpen(false)}
        />
      </div>
    </Spin>
  );
};

export default YouTubeScraperPage;
