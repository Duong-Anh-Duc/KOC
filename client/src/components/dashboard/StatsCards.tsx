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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD, formatVND } from '../../utils';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface StatsCardsProps {
  overview: any;
  cycleSummary: any;
}

const iconBoxStyle = (bg: string, small?: boolean): React.CSSProperties => ({
  width: small ? 36 : 48,
  height: small ? 36 : 48,
  borderRadius: small ? 8 : 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bg,
  fontSize: small ? 16 : 22,
  color: '#fff',
  flexShrink: 0,
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
  }}>
    {children}
  </div>
);

const StatsCards: React.FC<StatsCardsProps> = ({ overview, cycleSummary }) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isCompact = !screens.xl;
  const isSmall = !screens.md;

  const vSize = isSmall ? 18 : isCompact ? 20 : 26;
  const cardPad = isSmall ? '14px 12px' : '18px 20px';

  const pubCodeStats = overview?.pubCodeStats;
  const pubCodeMatchRate = pubCodeStats?.total > 0
    ? Math.round((pubCodeStats.matched / pubCodeStats.total) * 100)
    : 0;

  return (
    <>
      {/* Row 1: 4 KPI cards — luôn 2 cột trên mobile, 4 cột trên lg+ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} lg={6}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 14 }}>
              <div style={iconBoxStyle('#52c41a', isCompact)}>
                <TeamOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  {t('dashboard.activeKOCs')}
                </Text>
                <ValueText color="#52c41a" size={vSize}>
                  {overview?.activeKOCs || 0} / {overview?.totalKOCs || 0}
                </ValueText>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 14 }}>
              <div style={iconBoxStyle('#fa8c16', isCompact)}>
                <DollarOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  {t('dashboard.totalRevenue')}
                </Text>
                <ValueText color="#fa8c16" size={vSize}>
                  {formatUSD(cycleSummary?.totalOriginal || 0)}
                </ValueText>
                {cycleSummary && (
                  <Text type="secondary" style={{ fontSize: 11 }}>{cycleSummary.cycle.month}</Text>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 14 }}>
              <div style={iconBoxStyle('#1677ff', isCompact)}>
                <DollarOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  {t('dashboard.kocPayVND')}
                </Text>
                <ValueText color="#1677ff" size={isSmall ? 16 : isCompact ? 18 : 22}>
                  {formatVND(cycleSummary?.totalKocReceiveVnd || 0)}
                </ValueText>
                {cycleSummary && (
                  <Text type="secondary" style={{ fontSize: 11 }}>≈ {formatUSD(cycleSummary.totalKocReceiveUsd)}</Text>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 14 }}>
              <div style={iconBoxStyle('#722ed1', isCompact)}>
                <DollarOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  {t('dashboard.companyShare')}
                </Text>
                <ValueText color="#722ed1" size={vSize}>
                  {formatUSD(cycleSummary?.totalCompanyShare || 0)}
                </ValueText>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 2: Cycle status, PUB check, Exchange rate */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
              {t('dashboard.cycleStatus')}
            </Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <Tooltip title={t('status.OPEN')}>
                <Tag icon={<UnlockOutlined />} color="green" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {overview?.cyclesByStatus?.OPEN || 0}
                </Tag>
              </Tooltip>
              <Tooltip title={t('status.LOCKED')}>
                <Tag icon={<LockOutlined />} color="orange" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {overview?.cyclesByStatus?.LOCKED || 0}
                </Tag>
              </Tooltip>
              <Tooltip title={t('status.PAYMENT_COMPLETED')}>
                <Tag icon={<CheckCircleOutlined />} color="blue" style={{ margin: 0, padding: '4px 12px', fontSize: 14 }}>
                  {overview?.cyclesByStatus?.PAYMENT_COMPLETED || 0}
                </Tag>
              </Tooltip>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('dashboard.totalCycles')}: {overview?.totalCycles || 0}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
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
              <Tooltip title={t('dashboard.pubCodeMatched')}>
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
                  {pubCodeStats?.matched || 0}
                </Tag>
              </Tooltip>
              <Tooltip title={t('dashboard.pubCodeMismatched')}>
                <Tag icon={<CloseCircleOutlined />} color="error" style={{ margin: 0 }}>
                  {pubCodeStats?.mismatched || 0}
                </Tag>
              </Tooltip>
              <Tooltip title={t('dashboard.pubCodeNotChecked')}>
                <Tag icon={<FileTextOutlined />} color="default" style={{ margin: 0 }}>
                  {pubCodeStats?.notChecked || 0}
                </Tag>
              </Tooltip>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card styles={{ body: { padding: cardPad } }} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 14 }}>
              <div style={iconBoxStyle('#1890ff', isCompact)}>
                <SwapOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>
                  {t('dashboard.currentExchangeRate')}
                </Text>
                <ValueText color="#1890ff" size={isSmall ? 18 : 22}>
                  {Number(overview?.latestExchangeRate || 0).toLocaleString('vi-VN')} <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>{t('common.vndUsd')}</span>
                </ValueText>
                {cycleSummary && (
                  <Text type="secondary" style={{ fontSize: 11 }}>{cycleSummary.cycle.month}</Text>
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default StatsCards;
