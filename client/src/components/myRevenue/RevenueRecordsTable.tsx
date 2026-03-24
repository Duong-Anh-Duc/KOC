import { Empty, Grid, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueRecord } from '../../types';

const { useBreakpoint } = Grid;

const { Text } = Typography;

type RecordWithCycle = RevenueRecord & {
  cycle: { id: number; month: string; status: string; exchange_rate: number };
};

interface Props {
  records: RecordWithCycle[];
}

const RevenueRecordsTable: React.FC<Props> = ({ records }) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const columns: ColumnsType<RecordWithCycle> = [
    {
      title: t('common.stt'),
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('revenue.month'),
      key: 'month',
      width: 100,
      render: (_: unknown, record: RecordWithCycle) => <Tag color="blue">{record.cycle.month}</Tag>,
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
      responsive: ['md'],
      render: (val: number) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.bankFee'),
      dataIndex: 'bank_fee',
      key: 'bank_fee',
      width: 100,
      align: 'right',
      responsive: ['md'],
      render: (val: number) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.netRevenue'),
      dataIndex: 'net_revenue',
      key: 'net_revenue',
      width: 120,
      align: 'right',
      responsive: ['lg'],
      render: (val: number) => `$${Math.max(0, Number(val)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('revenue.kocReceiveUsd'),
      dataIndex: 'koc_receive_usd',
      key: 'koc_receive_usd',
      width: 130,
      align: 'right',
      render: (val: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${Math.max(0, Number(val)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
          {Math.max(0, Number(val)).toLocaleString('vi-VN')}₫
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

  if (records.length === 0) return <Empty description={t('kocPortal.noRevenue')} />;

  return (
    <Table<RecordWithCycle>
      columns={columns}
      dataSource={records}
      rowKey="id"
      bordered
      pagination={{ pageSize: 12 }}
      scroll={{ x: isMobile ? 'max-content' : 960 }}
      size="middle"
    />
  );
};

export default RevenueRecordsTable;
