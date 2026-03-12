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
import { Card, Col, Progress, Row, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD, formatVND } from '../../utils';

const { Text } = Typography;

interface StatsCardsProps {
  overview: any;
  cycleSummary: any;
}

const iconBoxStyle = (bg: string): React.CSSProperties => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bg,
  fontSize: 22,
  color: '#fff',
  flexShrink: 0,
});

const StatsCards: React.FC<StatsCardsProps> = ({ overview, cycleSummary }) => {
  const { t } = useTranslation();

  const pubCodeStats = overview?.pubCodeStats;
  const pubCodeMatchRate = pubCodeStats?.total > 0
    ? Math.round((pubCodeStats.matched / pubCodeStats.total) * 100)
    : 0;

  return (
    <>
      {/* Row 1: 4 KPI cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#52c41a')}>
                <TeamOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  {t('dashboard.activeKOCs')}
                </Text>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#52c41a', lineHeight: 1 }}>
                  {overview?.activeKOCs || 0}
                </span>
                <span style={{ fontSize: 16, color: '#8c8c8c', fontWeight: 500 }}>
                  {' '}/ {overview?.totalKOCs || 0}
                </span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#fa8c16')}>
                <DollarOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  {t('dashboard.totalRevenue')}
                </Text>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#fa8c16', lineHeight: 1 }}>
                  {formatUSD(cycleSummary?.totalOriginal || 0)}
                </span>
                {cycleSummary && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    {t('dashboard.latestCycle')}: {cycleSummary.cycle.month}
                  </Text>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#1677ff')}>
                <DollarOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  {t('dashboard.kocPayVND')}
                </Text>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1677ff', lineHeight: 1 }}>
                  {formatVND(cycleSummary?.totalKocReceiveVnd || 0)}
                </span>
                {cycleSummary && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    ≈ {formatUSD(cycleSummary.totalKocReceiveUsd)}
                  </Text>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#722ed1')}>
                <DollarOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  {t('dashboard.companyShare')}
                </Text>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#722ed1', lineHeight: 1 }}>
                  {formatUSD(cycleSummary?.totalCompanyShare || 0)}
                </span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 2: Cycle status, PUB check, Exchange rate */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
              {t('dashboard.cycleStatus')}
            </Text>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
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
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
              {t('dashboard.pubCodeVerification')}
            </Text>
            <Progress
              percent={pubCodeMatchRate}
              status={pubCodeMatchRate >= 80 ? 'success' : pubCodeMatchRate >= 50 ? 'normal' : 'exception'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
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
          <Card styles={{ body: { padding: '20px 24px' } }} style={{ height: '100%', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={iconBoxStyle('#1890ff')}>
                <SwapOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  {t('dashboard.currentExchangeRate')}
                </Text>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1890ff', lineHeight: 1 }}>
                  {Number(overview?.latestExchangeRate || 0).toLocaleString('vi-VN')}
                </span>
                <span style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500, marginLeft: 6 }}>
                  {t('common.vndUsd')}
                </span>
                {cycleSummary && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    {t('dashboard.latestCycle')}: {cycleSummary.cycle.month}
                  </Text>
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
