import { ArrowDownOutlined, ArrowUpOutlined, CalendarOutlined } from '@ant-design/icons';
import { Card, Col, Row, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD, formatVND } from '../../utils';

const { Text } = Typography;

interface CycleSummaryCardProps {
  cycleSummary: any;
  revenueGrowth?: number | null;
}

const MetricItem: React.FC<{
  label: string;
  value: string;
  color?: string;
  size?: number;
}> = ({ label, value, color, size = 22 }) => (
  <div className="dashboard-metric-item" style={{ padding: '8px 0' }}>
    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
      {label}
    </Text>
    <span style={{
      fontSize: size,
      fontWeight: 700,
      color,
      transition: 'color 0.3s ease, transform 0.3s ease',
      display: 'inline-block',
    }}>
      {value}
    </span>
  </div>
);

const CycleSummaryCard: React.FC<CycleSummaryCardProps> = ({ cycleSummary, revenueGrowth }) => {
  const { t } = useTranslation();

  if (!cycleSummary) return null;

  return (
    <Card
      style={{ height: '100%', borderRadius: 12, border: '1px solid #ED8F3A' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined style={{ color: '#ED8F3A' }} />
          <span>{t('dashboard.latestCycle')}: <strong>{cycleSummary.cycle.month}</strong></span>
          <Tag
            color={
              cycleSummary.cycle.status === 'OPEN'
                ? 'blue'
                : cycleSummary.cycle.status === 'LOCKED'
                  ? 'orange'
                  : 'green'
            }
          >
            {t(`status.${cycleSummary.cycle.status}`)}
          </Tag>
          {revenueGrowth != null && revenueGrowth !== 0 && (
            <Tag
              icon={revenueGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              color={revenueGrowth >= 0 ? 'success' : 'error'}
              style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}
            >
              {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
            </Tag>
          )}
        </div>
      }
    >
      <Row gutter={[16, 8]}>
        <Col xs={12} md={6}>
          <MetricItem
            label={t('dashboard.totalRevenue')}
            value={formatUSD(cycleSummary.totalOriginal)}
          />
        </Col>
        <Col xs={12} md={6}>
          <MetricItem
            label={t('dashboard.netRevenue')}
            value={formatUSD(cycleSummary.totalNetRevenue)}
          />
        </Col>
        <Col xs={12} md={6}>
          <MetricItem
            label={t('dashboard.kocPayUSD')}
            value={formatUSD(cycleSummary.totalKocReceiveUsd)}
            color="#52c41a"
          />
        </Col>
        <Col xs={12} md={6}>
          <MetricItem
            label={t('dashboard.kocPayVND')}
            value={formatVND(cycleSummary.totalKocReceiveVnd)}
            color="#fa8c16"
            size={20}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default CycleSummaryCard;
