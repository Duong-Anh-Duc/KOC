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

const CycleSummaryCard: React.FC<CycleSummaryCardProps> = ({ cycleSummary, revenueGrowth }) => {
  const { t } = useTranslation();

  if (!cycleSummary) return null;

  return (
    <Card
      style={{ height: '100%', borderRadius: 12 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined />
          <span>{t('dashboard.latestCycle')}: {cycleSummary.cycle.month}</span>
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
        </div>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('dashboard.totalRevenue')}
          </Text>
          <span style={{ fontSize: 22, fontWeight: 700 }}>
            {formatUSD(cycleSummary.totalOriginal)}
          </span>
        </Col>
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('dashboard.netRevenue')}
          </Text>
          <span style={{ fontSize: 22, fontWeight: 700 }}>
            {formatUSD(cycleSummary.totalNetRevenue)}
          </span>
        </Col>
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('dashboard.kocPayUSD')}
          </Text>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>
            {formatUSD(cycleSummary.totalKocReceiveUsd)}
          </span>
        </Col>
        <Col xs={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('dashboard.kocPayVND')}
          </Text>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>
            {formatVND(cycleSummary.totalKocReceiveVnd)}
          </span>
        </Col>
      </Row>

      <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>{t('dashboard.revenueGrowth')}:</Text>
        {revenueGrowth != null && revenueGrowth !== 0 ? (
          <Tag
            icon={revenueGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            color={revenueGrowth >= 0 ? 'success' : 'error'}
            style={{ fontSize: 14, padding: '2px 10px', margin: 0 }}
          >
            {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
          </Tag>
        ) : (
          <Tag color="default" style={{ fontSize: 14, padding: '2px 10px', margin: 0 }}>—</Tag>
        )}
      </div>
    </Card>
  );
};

export default CycleSummaryCard;
