import { ArrowDownOutlined, ArrowUpOutlined, CalendarOutlined } from '@ant-design/icons';
import { Card, Col, Row, Statistic, Tag } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatVND } from '../../utils';

interface CycleSummaryCardProps {
  cycleSummary: any;
  revenueGrowth?: number | null;
}

const CycleSummaryCard: React.FC<CycleSummaryCardProps> = ({ cycleSummary, revenueGrowth }) => {
  const { t } = useTranslation();

  if (!cycleSummary) return null;

  return (
    <Card
      style={{ height: '100%' }}
      title={
        <span>
          <CalendarOutlined style={{ marginRight: 8 }} />
          {t('dashboard.latestCycle')}: {cycleSummary.cycle.month}
          <Tag
            color={
              cycleSummary.cycle.status === 'OPEN'
                ? 'blue'
                : cycleSummary.cycle.status === 'LOCKED'
                  ? 'orange'
                  : 'green'
            }
            style={{ marginLeft: 8 }}
          >
            {t(`status.${cycleSummary.cycle.status}`)}
          </Tag>
        </span>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={5}>
          <Statistic title={t('dashboard.totalRevenue')} value={cycleSummary.totalOriginal} precision={2} prefix="$" />
        </Col>
        <Col xs={12} lg={5}>
          <Statistic title={t('dashboard.netRevenue')} value={cycleSummary.totalNetRevenue} precision={2} prefix="$" />
        </Col>
        <Col xs={12} lg={5}>
          <Statistic
            title={t('dashboard.kocPayUSD')}
            value={cycleSummary.totalKocReceiveUsd}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col xs={12} lg={5}>
          <Statistic
            title={t('dashboard.kocPayVND')}
            value={cycleSummary.totalKocReceiveVnd}
            formatter={(val) => formatVND(Number(val))}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Col>
        <Col xs={12} lg={4}>
          <div>
            <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, whiteSpace: 'nowrap' }}>{t('dashboard.revenueGrowth')}</span>
            <div style={{ marginTop: 8 }}>
              {revenueGrowth != null && revenueGrowth !== 0 ? (
                <Tag
                  icon={revenueGrowth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  color={revenueGrowth >= 0 ? 'success' : 'error'}
                  style={{ fontSize: 16, padding: '4px 12px' }}
                >
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
                </Tag>
              ) : (
                <Tag color="default" style={{ fontSize: 14, padding: '4px 12px' }}>—</Tag>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default CycleSummaryCard;
