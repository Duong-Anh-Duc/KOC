import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    DollarOutlined,
    FileTextOutlined,
    LockOutlined,
    SwapOutlined,
    TeamOutlined,
    UnlockOutlined,
} from '@ant-design/icons';
import { Card, Col, Grid, Progress, Row, Tag, Tooltip, Typography } from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD, formatVND } from '../../utils';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface StatsCardsProps {
  overview: any;
  cycleSummary: any;
}

const gradients: Record<string, string> = {
  green: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
  orange: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)',
  blue: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
  purple: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
  cyan: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
};

const iconBoxStyle = (gradient: string, small?: boolean): React.CSSProperties => ({
  width: small ? 40 : 52,
  height: small ? 40 : 52,
  borderRadius: small ? 10 : 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: gradient,
  fontSize: small ? 18 : 24,
  color: '#fff',
  flexShrink: 0,
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
});

/** Giá trị tự co font theo container — không bao giờ bẻ dòng */
const ValueText: React.FC<{ color?: string; size: number; children: React.ReactNode }> = ({ color, size, children }) => (
  <div style={{
    fontSize: size,
    fontWeight: 700,
    color,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'color 0.3s ease',
  }}>
    {children}
  </div>
);

const KpiCard: React.FC<{
  icon: React.ReactNode;
  gradient: string;
  label: string;
  children: React.ReactNode;
  isCompact?: boolean;
  isSmall?: boolean;
  accentColor: string;
}> = ({ icon, gradient, label, children, isCompact, isSmall, accentColor }) => {
  const cardPad = isSmall ? '14px 12px' : '18px 20px';
  return (
    <Card
      className="dashboard-kpi-card"
      styles={{ body: { padding: cardPad } }}
      style={{ height: '100%', border: `1px solid ${accentColor}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 10 : 14 }}>
        <div className="dashboard-kpi-icon" style={iconBoxStyle(gradient, isCompact)}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
            {label}
          </Text>
          {children}
        </div>
      </div>
    </Card>
  );
};

const StatsCards: React.FC<StatsCardsProps> = ({ overview, cycleSummary }) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isCompact = !screens.xl;
  const isSmall = !screens.md;

  const vSize = isSmall ? 18 : isCompact ? 20 : 26;

  const pubCodeStats = overview?.pubCodeStats;
  const pubCodeMatchRate = pubCodeStats?.total > 0
    ? Math.round((pubCodeStats.matched / pubCodeStats.total) * 100)
    : 0;

  return (
    <>
      {/* Row 1: 4 KPI cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} lg={6}>
          <KpiCard
            icon={<TeamOutlined />}
            gradient={gradients.green}
            label={t('dashboard.activeKOCs')}
            isCompact={isCompact}
            isSmall={isSmall}
            accentColor="#52c41a"
          >
            <ValueText color="#52c41a" size={vSize}>
              {overview?.activeKOCs || 0} / {overview?.totalKOCs || 0}
            </ValueText>
          </KpiCard>
        </Col>

        <Col xs={12} lg={6}>
          <KpiCard
            icon={<DollarOutlined />}
            gradient={gradients.orange}
            label={t('dashboard.totalRevenue')}
            isCompact={isCompact}
            isSmall={isSmall}
            accentColor="#fa8c16"
          >
            <ValueText color="#fa8c16" size={vSize}>
              {formatUSD(cycleSummary?.totalOriginal || 0)}
            </ValueText>
            {cycleSummary && (
              <Text type="secondary" style={{ fontSize: 11 }}>{cycleSummary.cycle.month}</Text>
            )}
          </KpiCard>
        </Col>

        <Col xs={12} lg={6}>
          <KpiCard
            icon={<DollarOutlined />}
            gradient={gradients.blue}
            label={t('dashboard.kocPayVND')}
            isCompact={isCompact}
            isSmall={isSmall}
            accentColor="#1677ff"
          >
            <ValueText color="#1677ff" size={isSmall ? 16 : isCompact ? 18 : 22}>
              {formatVND(cycleSummary?.totalKocReceiveVnd || 0)}
            </ValueText>
            {cycleSummary && (
              <Text type="secondary" style={{ fontSize: 11 }}>≈ {formatUSD(cycleSummary.totalKocReceiveUsd)}</Text>
            )}
          </KpiCard>
        </Col>

        <Col xs={12} lg={6}>
          <KpiCard
            icon={<DollarOutlined />}
            gradient={gradients.purple}
            label={t('dashboard.companyShare')}
            isCompact={isCompact}
            isSmall={isSmall}
            accentColor="#722ed1"
          >
            <ValueText color="#722ed1" size={vSize}>
              {formatUSD(cycleSummary?.totalCompanyShare || 0)}
            </ValueText>
          </KpiCard>
        </Col>
      </Row>

      {/* Row 2: Cycle status, PUB check, Exchange rate */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card className="dashboard-info-card" styles={{ body: { padding: isSmall ? '14px 12px' : '18px 20px' } }} style={{ height: '100%', border: '1px solid #fa8c16' }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
              {t('dashboard.cycleStatus')}
            </Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <AppTooltip title={t('status.OPEN')}>
                <AppTag icon={<UnlockOutlined />} color="green" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {' '}{overview?.cyclesByStatus?.OPEN || 0}
                </AppTag>
              </AppTooltip>
              <AppTooltip title={t('status.LOCKED')}>
                <AppTag icon={<LockOutlined />} color="orange" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {' '}{overview?.cyclesByStatus?.LOCKED || 0}
                </AppTag>
              </AppTooltip>
              <AppTooltip title={t('status.PAYMENT_COMPLETED')}>
                <AppTag icon={<CheckCircleOutlined />} color="blue" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {' '}{overview?.cyclesByStatus?.PAYMENT_COMPLETED || 0}
                </AppTag>
              </AppTooltip>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('dashboard.totalCycles')}: {overview?.totalCycles || 0}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card className="dashboard-info-card" styles={{ body: { padding: isSmall ? '14px 12px' : '18px 20px' } }} style={{ height: '100%', border: '1px solid #52c41a' }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
              {t('dashboard.pubCodeVerification')}
            </Text>
            <Progress
              percent={pubCodeMatchRate}
              status={pubCodeMatchRate >= 80 ? 'success' : pubCodeMatchRate >= 50 ? 'normal' : 'exception'}
              strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
              style={{ marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
              <AppTooltip title={t('dashboard.pubCodeMatched')}>
                <AppTag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {' '}{pubCodeStats?.matched || 0}
                </AppTag>
              </AppTooltip>
              <AppTooltip title={t('dashboard.pubCodeMismatched')}>
                <AppTag icon={<CloseCircleOutlined />} color="error" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {' '}{pubCodeStats?.mismatched || 0}
                </AppTag>
              </AppTooltip>
              <AppTooltip title={t('dashboard.pubCodeNotChecked')}>
                <AppTag icon={<FileTextOutlined />} color="default" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {' '}{pubCodeStats?.notChecked || 0}
                </AppTag>
              </AppTooltip>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            icon={<SwapOutlined />}
            gradient={gradients.cyan}
            label={t('dashboard.currentExchangeRate')}
            isCompact={isCompact}
            isSmall={isSmall}
            accentColor="#1890ff"
          >
            <ValueText color="#1890ff" size={isSmall ? 18 : 22}>
              {Number(overview?.latestExchangeRate || 0).toLocaleString('vi-VN')} <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>{t('common.vndUsd')}</span>
            </ValueText>
            {cycleSummary && (
              <Text type="secondary" style={{ fontSize: 11 }}>{cycleSummary.cycle.month}</Text>
            )}
          </KpiCard>
        </Col>
      </Row>
    </>
  );
};

export default StatsCards;
