import { DashboardOutlined } from '@ant-design/icons';
import { Col, Row, Spin, Typography } from 'antd';
import { AppSpin, AppTooltip } from '../components/common';
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
import { useAppStore, useAuthStore } from '../stores';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const darkMode = useAppStore((s) => s.darkMode);
  const user = useAuthStore((s) => s.user);
  const { data: overview, isLoading: loadingOverview } = useDashboardOverview();
  const { data: trendData, isLoading: loadingTrend } = useRevenueTrend(12);

  if (loadingOverview) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <AppSpin size="large" />
      </div>
    );
  }

  const cycleSummary = overview?.latestCycleSummary;
  const growthSummary = overview?.growthSummary || [];

  const latestTrend = trendData && trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const revenueGrowth = latestTrend?.revenueGrowth ?? null;

  const chartColors = {
    grid: darkMode ? '#434343' : '#f0f0f0',
    text: darkMode ? '#d9d9d9' : '#595959',
    tooltipBg: darkMode ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: darkMode ? '#434343' : '#f0f0f0',
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('dashboard.goodMorning', 'Chào buổi sáng')
    : hour < 18 ? t('dashboard.goodAfternoon', 'Chào buổi chiều')
    : t('dashboard.goodEvening', 'Chào buổi tối');

  return (
    <div className="dashboard-page">
      {/* Welcome Header */}
      <div className={`dashboard-header ${darkMode ? 'dashboard-header-dark' : ''}`}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{greeting},</Text>
          <Title level={3} style={{ margin: '4px 0 0', color: '#fff' }}>
            <DashboardOutlined style={{ marginRight: 8 }} />
            {user?.full_name || t('menu.dashboard')}
          </Title>
          {cycleSummary && (
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              {t('dashboard.latestCycle')}: <strong>{cycleSummary.cycle.month}</strong>
            </Text>
          )}
        </div>
        <div className="dashboard-header-circle dashboard-header-circle-1" />
        <div className="dashboard-header-circle dashboard-header-circle-2" />
      </div>

      {/* KPI Cards with stagger */}
      <div className="dashboard-stagger-1">
        <StatsCards overview={overview} cycleSummary={cycleSummary} />
      </div>

      {/* Middle Row */}
      <div className="dashboard-stagger-2">
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {cycleSummary && (
            <Col xs={24} xl={14}>
              <CycleSummaryCard cycleSummary={cycleSummary} revenueGrowth={revenueGrowth} />
            </Col>
          )}
          <Col xs={24} xl={cycleSummary ? 10 : 24}>
            <GrowthSummaryCard growthSummary={growthSummary} />
          </Col>
        </Row>
      </div>

      {/* Charts */}
      <div className="dashboard-stagger-3">
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <RevenueTrendChart trendData={trendData || []} loading={loadingTrend} chartColors={chartColors} />
          </Col>
          <Col xs={24} xl={12}>
            <CompanyVsKocChart trendData={trendData || []} loading={loadingTrend} chartColors={chartColors} />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default DashboardPage;
