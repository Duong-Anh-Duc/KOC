import { Col, Row, Spin } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompanyVsKocChart,
  CycleSummaryCard,
  GrowthSummaryCard,
  RevenueTrendChart,
  StatsCards,
} from '../components/dashboard';
import { useDashboardOverview, useRevenueTrend } from '../hooks';
import { useAppStore } from '../stores';

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const darkMode = useAppStore((s) => s.darkMode);
  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = useDashboardOverview();
  const { data: trendData, isLoading: loadingTrend } = useRevenueTrend(12);

  if (loadingOverview) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const cycleSummary = overview?.latestCycleSummary;
  const growthSummary = overview?.growthSummary || [];

  // Find latest cycle's revenue growth % from trend data
  const latestTrend = trendData && trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const revenueGrowth = latestTrend?.revenueGrowth ?? null;

  const chartColors = {
    grid: darkMode ? '#434343' : '#f0f0f0',
    text: darkMode ? '#d9d9d9' : '#595959',
    tooltipBg: darkMode ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: darkMode ? '#434343' : '#f0f0f0',
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{t('menu.dashboard')}</h2>
      </div>

      <StatsCards overview={overview} cycleSummary={cycleSummary} />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {cycleSummary && (
          <Col xs={24} xl={14}>
            <CycleSummaryCard cycleSummary={cycleSummary} revenueGrowth={revenueGrowth} />
          </Col>
        )}
        <Col xs={24} xl={cycleSummary ? 10 : 24}>
          <GrowthSummaryCard growthSummary={growthSummary} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <RevenueTrendChart trendData={trendData || []} loading={loadingTrend} chartColors={chartColors} />
        </Col>
        <Col xs={24} xl={12}>
          <CompanyVsKocChart trendData={trendData || []} loading={loadingTrend} chartColors={chartColors} />
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
