import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    DollarOutlined,
    FileTextOutlined,
    LockOutlined,
    TeamOutlined,
    UnlockOutlined,
} from '@ant-design/icons';
import { Card, Col, Progress, Row, Statistic, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD, formatVND } from '../../utils';

const { Text } = Typography;

interface StatsCardsProps {
  overview: any;
  cycleSummary: any;
}

const StatsCards: React.FC<StatsCardsProps> = ({ overview, cycleSummary }) => {
  const { t } = useTranslation();

  const pubCodeStats = overview?.pubCodeStats;
  const pubCodeMatchRate = pubCodeStats?.total > 0
    ? Math.round((pubCodeStats.matched / pubCodeStats.total) * 100)
    : 0;

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title={t('dashboard.activeKOCs')}
              value={overview?.activeKOCs || 0}
              suffix={`/ ${overview?.totalKOCs || 0}`}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title={t('dashboard.totalRevenue')}
              value={cycleSummary?.totalOriginal || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
              formatter={(val) => formatUSD(Number(val))}
            />
            {cycleSummary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.latestCycle')}: {cycleSummary.cycle.month}
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title={t('dashboard.kocPayVND')}
              value={cycleSummary?.totalKocReceiveVnd || 0}
              formatter={(val) => formatVND(Number(val))}
              valueStyle={{ color: '#1677ff' }}
            />
            {cycleSummary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                ≈ {formatUSD(cycleSummary.totalKocReceiveUsd)}
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title={t('dashboard.companyShare')}
              value={cycleSummary?.totalCompanyShare || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
              formatter={(val) => formatUSD(Number(val))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card style={{ height: '100%' }}>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">{t('dashboard.cycleStatus')}</Text>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Tooltip title={t('status.OPEN')}>
                <Tag icon={<UnlockOutlined />} color="green" style={{ margin: 0 }}>
                  {overview?.cyclesByStatus?.OPEN || 0}
                </Tag>
              </Tooltip>
              <Tooltip title={t('status.LOCKED')}>
                <Tag icon={<LockOutlined />} color="orange" style={{ margin: 0 }}>
                  {overview?.cyclesByStatus?.LOCKED || 0}
                </Tag>
              </Tooltip>
              <Tooltip title={t('status.PAYMENT_COMPLETED')}>
                <Tag icon={<CheckCircleOutlined />} color="blue" style={{ margin: 0 }}>
                  {overview?.cyclesByStatus?.PAYMENT_COMPLETED || 0}
                </Tag>
              </Tooltip>
            </div>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.totalCycles')}: {overview?.totalCycles || 0}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card style={{ height: '100%' }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">{t('dashboard.pubCodeVerification')}</Text>
            </div>
            <Progress
              percent={pubCodeMatchRate}
              status={pubCodeMatchRate >= 80 ? 'success' : pubCodeMatchRate >= 50 ? 'normal' : 'exception'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12 }}>
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
          <Card style={{ height: '100%' }}>
            <Statistic
              title={t('dashboard.currentExchangeRate')}
              value={overview?.latestExchangeRate || 0}
              suffix={t('common.vndUsd')}
              precision={0}
              valueStyle={{ color: '#1890ff', fontSize: 20 }}
              formatter={(val) => Number(val).toLocaleString('vi-VN')}
            />
            {cycleSummary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.latestCycle')}: {cycleSummary.cycle.month}
              </Text>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default StatsCards;
