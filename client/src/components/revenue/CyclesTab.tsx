import { CalendarOutlined, CheckCircleOutlined, DollarOutlined, EditOutlined, LockOutlined, UnlockOutlined, DollarCircleOutlined } from '@ant-design/icons';
import { Button, Grid, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle } from '../../types';
import { getTableLocale } from '../../utils';
import { SummaryBar } from '../common';

const { useBreakpoint } = Grid;

interface CyclesTabProps {
  cycles: RevenueCycle[] | undefined;
  loading: boolean;
  canManageCycle: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onCycleClick: (cycle: RevenueCycle) => void;
  onEditCycle: (cycle: RevenueCycle) => void;
  onLockCycle: (id: number) => void;
  lockLoading: boolean;
  onReopenCycle: (id: number) => void;
  reopenLoading: boolean;
  onCompleteCycle: (id: number) => void;
  completeLoading: boolean;
  onLockExchangeRate: (id: number) => void;
  onUnlockExchangeRate: (id: number) => void;
  lockExchangeRateLoading: boolean;
}

const statusColorMap: Record<string, string> = {
  OPEN: 'blue',
  LOCKED: 'orange',
  COMPLETED: 'green',
  PAYMENT_COMPLETED: 'green',
};

const CyclesTab: React.FC<CyclesTabProps> = ({
  cycles,
  loading,
  canManageCycle,
  pageSize,
  onPageSizeChange,
  onCycleClick,
  onEditCycle,
  onLockCycle,
  lockLoading,
  onReopenCycle,
  reopenLoading,
  onCompleteCycle,
  completeLoading,
  onLockExchangeRate,
  onUnlockExchangeRate,
  lockExchangeRateLoading,
}) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const cycleColumns: ColumnsType<RevenueCycle> = [
    {
      title: t('common.stt'),
      width: 60,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('cycle.month'),
      dataIndex: 'month',
      width: 120,
    },
    {
      title: t('revenue.exchangeRate'),
      dataIndex: 'exchange_rate',
      width: 170,
      responsive: ['sm'],
      render: (val: string, record: RevenueCycle) => (
        <Space size={4}>
          <span>{Number(val).toLocaleString()} {t('common.vnd')}</span>
          {record.exchange_rate_locked && (
            <Tooltip title={t('cycle.exchangeRateLocked')}>
              <LockOutlined style={{ color: '#faad14', fontSize: 12 }} />
            </Tooltip>
          )}
        </Space>
      ),
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
      width: 160,
      responsive: ['md'],
      render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('common.actions'),
      width: 180,
      fixed: 'right',
      align: 'center',
      className: 'actions-col',
      render: (_: unknown, record: RevenueCycle) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('revenue.viewRecords')}>
            <Button
              type="link"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => onCycleClick(record)}
            />
          </Tooltip>
          {record.status === 'OPEN' && canManageCycle && (
            <>
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#1677ff' }} />}
                  onClick={() => onEditCycle(record)}
                />
              </Tooltip>
              {record.exchange_rate_locked ? (
                <Popconfirm
                  title={t('confirm.unlockExchangeRate')}
                  onConfirm={() => onUnlockExchangeRate(record.id)}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                >
                  <Tooltip title={t('cycle.unlockExchangeRate')}>
                    <Button
                      type="text"
                      size="small"
                      loading={lockExchangeRateLoading}
                      icon={<DollarCircleOutlined style={{ color: '#faad14' }} />}
                    />
                  </Tooltip>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title={t('confirm.lockExchangeRate')}
                  onConfirm={() => onLockExchangeRate(record.id)}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                >
                  <Tooltip title={t('cycle.lockExchangeRate')}>
                    <Button
                      type="text"
                      size="small"
                      loading={lockExchangeRateLoading}
                      icon={<DollarCircleOutlined style={{ color: '#52c41a' }} />}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
              {canManageCycle && (
                <Popconfirm
                  title={t('confirm.lockCycle')}
                  onConfirm={() => onLockCycle(record.id)}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                >
                  <Tooltip title={t('cycle.lock')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<LockOutlined style={{ color: '#faad14' }} />}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
            </>
          )}
          {record.status === 'LOCKED' && canManageCycle && (
            <>
              <Popconfirm
                title={t('confirm.reopenCycle')}
                onConfirm={() => onReopenCycle(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Tooltip title={t('cycle.reopen')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<UnlockOutlined style={{ color: '#1677ff' }} />}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title={t('confirm.completeCycle')}
                onConfirm={() => onCompleteCycle(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Tooltip title={t('cycle.complete')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {record.status === 'PAYMENT_COMPLETED' && canManageCycle && (
            <Popconfirm
              title={t('confirm.reopenCycle')}
              onConfirm={() => onReopenCycle(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Tooltip title={t('cycle.reopen')}>
                <Button
                  type="text"
                  size="small"
                  icon={<UnlockOutlined style={{ color: '#1677ff' }} />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <SummaryBar
        items={[
          {
            title: t('dashboard.totalCycles'),
            value: cycles?.length || 0,
            prefix: <CalendarOutlined />,
            valueStyle: { color: '#1677ff' },
          },
          {
            title: t('dashboard.openCycles'),
            value: cycles?.filter((c) => c.status === 'OPEN').length || 0,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: t('dashboard.lockedCycles'),
            value: cycles?.filter((c) => c.status === 'LOCKED').length || 0,
            valueStyle: { color: '#faad14' },
          },
          {
            title: t('dashboard.completedCycles'),
            value: cycles?.filter((c) => c.status === 'PAYMENT_COMPLETED').length || 0,
            valueStyle: { color: '#52c41a' },
          },
        ]}
        loading={loading}
      />

      <Table
        columns={cycleColumns}
        dataSource={cycles || []}
        rowKey="id"
        loading={loading}
        bordered
        locale={getTableLocale(t)}
        scroll={{ x: isMobile ? 'max-content' : 800 }}
        onRow={(record) => ({
          onClick: (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.actions-col')) return;
            onCycleClick(record);
          },
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize,
          showTotal: (total) => `${t('common.total')}: ${total}`,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          onShowSizeChange: (_, size) => onPageSizeChange(size),
        }}
      />
    </>
  );
};

export default CyclesTab;
