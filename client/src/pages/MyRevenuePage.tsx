import {
  BarChartOutlined,
  CalendarOutlined,
  DollarOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Card,
  Col,
  Descriptions,
  Row,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../components/common';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMyRevenue, useMyStats } from '../hooks';
import MonthlyAnalyticsTable from '../components/myRevenue/MonthlyAnalyticsTable';
import RevenueRecordsTable from '../components/myRevenue/RevenueRecordsTable';
import type { RevenueRecord } from '../types';

const { Title } = Typography;

type RecordWithCycle = RevenueRecord & {
  cycle: { id: number; month: string; status: string; exchange_rate: number };
};

const MyRevenuePage: React.FC = () => {
  const { t } = useTranslation();
  const { data: revenueData, isLoading: isLoadingRevenue } = useMyRevenue();
  const { data: statsData, isLoading: isLoadingStats } = useMyStats();

  const koc = revenueData?.koc;
  const records = (revenueData?.records ?? []) as RecordWithCycle[];
  const monthlyAnalytics = statsData?.monthlyAnalytics ?? [];

  const totalRevenueUSD = records.reduce((sum, r) => sum + Math.max(0, Number(r.koc_receive_usd)), 0);
  const totalRevenueVND = records.reduce((sum, r) => sum + Math.max(0, Number(r.koc_receive_vnd)), 0);

  if (isLoadingRevenue || isLoadingStats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <AppSpin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={3}>
        <DollarOutlined style={{ marginRight: 8 }} />
        {t('kocPortal.title')}
      </Title>

      {koc && (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            title={<span><UserOutlined style={{ marginRight: 8 }} />{koc.full_name}</span>}
          >
            <Descriptions.Item label={t('koc.channelName')}>{koc.channel_name}</Descriptions.Item>
            <Descriptions.Item label={t('koc.email')}>{koc.email}</Descriptions.Item>
            <Descriptions.Item label={t('koc.baseRate')}>{(Number(koc.base_rate) * 100).toFixed(0)}%</Descriptions.Item>
            <Descriptions.Item label={t('koc.pubCode')}>
              {koc.pub_code ? <AppTag color="purple" style={{ fontFamily: 'monospace' }}>{koc.pub_code}</AppTag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('koc.status')}>
              <AppTag color={koc.status === 'ACTIVE' ? 'green' : 'default'}>
                {koc.status === 'ACTIVE' ? t('status.active') : t('status.inactive')}
              </AppTag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title={t('kocPortal.totalRecords')} value={records.length} prefix={<CalendarOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('kocPortal.totalEarningsUSD')}
              value={totalRevenueUSD}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(val) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('kocPortal.totalEarningsVND')}
              value={totalRevenueVND}
              precision={0}
              prefix="₫"
              valueStyle={{ color: '#fa8c16' }}
              formatter={(val) => Number(val).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<span><EyeOutlined style={{ marginRight: 8 }} />{t('kocPortal.revenueHistory')}</span>}
        style={{ marginBottom: 24 }}
      >
        <RevenueRecordsTable records={records} />
      </Card>

      {monthlyAnalytics.length > 0 && (
        <Card title={<span><BarChartOutlined style={{ marginRight: 8 }} />{t('kocPortal.monthlyAnalytics')}</span>}>
          <MonthlyAnalyticsTable data={monthlyAnalytics} />
        </Card>
      )}
    </div>
  );
};

export default MyRevenuePage;
