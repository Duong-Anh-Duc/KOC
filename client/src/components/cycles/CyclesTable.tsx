import { CheckCircleOutlined, EditOutlined, LockOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle } from '../../types';
import { getTableLocale } from '../../utils';

const statusColorMap: Record<string, string> = {
  OPEN: 'blue',
  LOCKED: 'orange',
  PAYMENT_COMPLETED: 'green',
};

interface CyclesTableProps {
  cycles: RevenueCycle[];
  loading: boolean;
  isAdmin: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onEdit: (cycle: RevenueCycle) => void;
  onLock: (id: number) => void;
  onComplete: (id: number) => void;
}

const CyclesTable: React.FC<CyclesTableProps> = ({
  cycles,
  loading,
  isAdmin,
  pageSize,
  onPageSizeChange,
  onEdit,
  onLock,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

  const columns: ColumnsType<RevenueCycle> = [
    {
      title: t('common.stt'),
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: t('common.id'),
      dataIndex: 'id',
      width: 60,
    },
    {
      title: t('cycle.month'),
      dataIndex: 'month',
      width: 120,
    },
    {
      title: t('revenue.exchangeRate'),
      dataIndex: 'exchange_rate',
      width: 140,
      render: (val: string) => Number(val).toLocaleString() + ' ' + t('common.vnd'),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={statusColorMap[status]}>{t(`status.${status}`, status)}</Tag>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('common.actions'),
      width: 140,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: RevenueCycle) => (
        <Space size="small">
          {record.status === 'OPEN' && (
            <>
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#1677ff' }} />}
                  onClick={() => onEdit(record)}
                  style={{ padding: '4px 8px' }}
                />
              </Tooltip>
              {isAdmin && (
                <Popconfirm
                  title={t('confirm.lockCycle')}
                  onConfirm={() => onLock(record.id)}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                >
                  <Tooltip title={t('cycle.lock')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<LockOutlined style={{ color: '#faad14' }} />}
                      style={{ padding: '4px 8px' }}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
            </>
          )}
          {record.status === 'LOCKED' && isAdmin && (
            <Popconfirm
              title={t('confirm.completeCycle')}
              onConfirm={() => onComplete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip title={t('cycle.complete')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  style={{ padding: '4px 8px' }}
                />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status === 'PAYMENT_COMPLETED' && (
            <Tag color="green" style={{ marginRight: 0 }}>{t('status.completed')}</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={cycles}
      rowKey="id"
      loading={loading}
      bordered
      locale={getTableLocale(t)}
      scroll={{ x: 1000 }}
      pagination={{
        current: currentPage,
        pageSize,
        showTotal: (total) => `${t('common.total')}: ${total}`,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        onChange: (p) => setCurrentPage(p),
        onShowSizeChange: (_, size) => { setCurrentPage(1); onPageSizeChange(size); },
      }}
    />
  );
};

export default CyclesTable;
