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
    Empty,
    Row,
    Spin,
    Statistic,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMyRevenue, useMyStats } from '../hooks';
import type { MonthlyRevenueAnalytics, RevenueRecord } from '../types';

const { Title, Text } = Typography;

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

  const totalRevenueUSD = records.reduce((sum, r) => sum + Number(r.koc_receive_usd), 0);
  const totalRevenueVND = records.reduce((sum, r) => sum + Number(r.koc_receive_vnd), 0);

  const revenueColumns: ColumnsType<RecordWithCycle> = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('revenue.month'),
      key: 'month',
      width: 100,
      render: (_: unknown, record: RecordWithCycle) => (
        <Tag color="blue">{record.cycle.month}</Tag>
      ),
    },
    {
      title: t('revenue.originalRevenue'),
      dataIndex: 'original_revenue_usd',
      key: 'original_revenue_usd',
      width: 130,
      align: 'right',
      render: (val: number) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.usTax'),
      dataIndex: 'us_tax_deduction',
      key: 'us_tax_deduction',
      width: 100,
      align: 'right',
      render: (val: number) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.bankFee'),
      dataIndex: 'bank_fee',
      key: 'bank_fee',
      width: 100,
      align: 'right',
      render: (val: number) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.netRevenue'),
      dataIndex: 'net_revenue',
      key: 'net_revenue',
      width: 120,
      align: 'right',
      render: (val: number) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.kocReceiveUsd'),
      dataIndex: 'koc_receive_usd',
      key: 'koc_receive_usd',
      width: 130,
      align: 'right',
      render: (val: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: t('revenue.kocReceiveVnd'),
      dataIndex: 'koc_receive_vnd',
      key: 'koc_receive_vnd',
      width: 150,
      align: 'right',
      render: (val: number) => (
        <Text strong style={{ color: '#1677ff' }}>
          {Number(val).toLocaleString('vi-VN')}₫
        </Text>
      ),
    },
    {
      title: t('revenue.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={status === 'APPROVED' ? 'green' : 'orange'}>
          {status === 'APPROVED' ? t('status.approved') : t('status.pending')}
        </Tag>
      ),
    },
  ];

  const monthlyColumns: ColumnsType<MonthlyRevenueAnalytics> = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('ytScraper.monthKey'),
      dataIndex: 'month_label',
      key: 'month_label',
      width: 120,
    },
    {
      title: t('stats.views'),
      dataIndex: 'views',
      key: 'views',
      width: 120,
      align: 'right',
      render: (val: number | null) => val != null ? val.toLocaleString() : '-',
    },
    {
      title: t('stats.watchTime'),
      dataIndex: 'watch_time_hours',
      key: 'watch_time_hours',
      width: 120,
      align: 'right',
      render: (val: number | null) => val != null ? val.toLocaleString() : '-',
    },
    {
      title: t('stats.revenue'),
      dataIndex: 'estimated_revenue',
      key: 'estimated_revenue',
      width: 130,
      align: 'right',
      render: (val: number | null) =>
        val != null
          ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          : '-',
    },
  ];

  if (isLoadingRevenue || isLoadingStats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={3}>
        <DollarOutlined style={{ marginRight: 8 }} />
        {t('kocPortal.title')}
      </Title>

      {/* KOC Info Card */}
      {koc && (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            title={
              <span>
                <UserOutlined style={{ marginRight: 8 }} />
                {koc.full_name}
              </span>
            }
          >
            <Descriptions.Item label={t('koc.channelName')}>
              {koc.channel_name}
            </Descriptions.Item>
            <Descriptions.Item label={t('koc.email')}>
              {koc.email}
            </Descriptions.Item>
            <Descriptions.Item label={t('koc.baseRate')}>
              {(Number(koc.base_rate) * 100).toFixed(0)}%
            </Descriptions.Item>
            <Descriptions.Item label={t('koc.pubCode')}>
              {koc.pub_code ? (
                <Tag color="purple" style={{ fontFamily: 'monospace' }}>{koc.pub_code}</Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('koc.status')}>
              <Tag color={koc.status === 'ACTIVE' ? 'green' : 'default'}>
                {koc.status === 'ACTIVE' ? t('status.active') : t('status.inactive')}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('kocPortal.totalRecords')}
              value={records.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
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

      {/* Revenue Records Table */}
      <Card
        title={
          <span>
            <EyeOutlined style={{ marginRight: 8 }} />
            {t('kocPortal.revenueHistory')}
          </span>
        }
        style={{ marginBottom: 24 }}
      >
        {records.length > 0 ? (
          <Table<RecordWithCycle>
            columns={revenueColumns}
            dataSource={records}
            rowKey="id"
            bordered
            pagination={{ pageSize: 12 }}
            scroll={{ x: 960 }}
            size="middle"
          />
        ) : (
          <Empty description={t('kocPortal.noRevenue')} />
        )}
      </Card>

      {/* Monthly Analytics */}
      {monthlyAnalytics.length > 0 && (
        <Card
          title={
            <span>
              <BarChartOutlined style={{ marginRight: 8 }} />
              {t('kocPortal.monthlyAnalytics')}
            </span>
          }
        >
          <Table<MonthlyRevenueAnalytics>
            columns={monthlyColumns}
            dataSource={monthlyAnalytics}
            rowKey="id"
            bordered
            pagination={false}
            scroll={{ x: 600 }}
            size="middle"
          />
        </Card>
      )}
    </div>
  );
};

export default MyRevenuePage;
