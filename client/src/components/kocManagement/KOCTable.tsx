import { DeleteOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KOC } from '../../types';
import { getTableLocale } from '../../utils';

interface KOCTableProps {
  kocs: KOC[];
  loading: boolean;
  isAdmin: boolean;
  page: number;
  pageSize: number;
  total: number;
  statusFilter: string | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit: (koc: KOC) => void;
  onDelete: (id: string) => void;
  onCreateAccount?: (koc: KOC) => void;
  kocHasAccount?: Record<string, boolean>;
}

const KOCTable: React.FC<KOCTableProps> = ({
  kocs,
  loading,
  isAdmin,
  page,
  pageSize,
  total,
  statusFilter,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  onCreateAccount,
  kocHasAccount,
}) => {
  const { t } = useTranslation();

  const columns: ColumnsType<KOC> = [
    {
      title: t('koc.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 160,
      sorter: true,
    },
    {
      title: t('koc.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 150,
    },
    {
      title: t('koc.email'),
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: t('koc.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: t('koc.bankName'),
      dataIndex: 'bank_name',
      key: 'bank_name',
      width: 140,
    },
    {
      title: t('koc.bankAccount'),
      dataIndex: 'bank_account_number',
      key: 'bank_account_number',
      width: 150,
    },
    {
      title: t('koc.baseRate'),
      dataIndex: 'base_rate',
      key: 'base_rate',
      width: 100,
      align: 'center',
      render: (val: number) => `${(Number(val) * 100).toFixed(0)}%`,
    },
    {
      title: t('koc.pubCode'),
      dataIndex: 'pub_code',
      key: 'pub_code',
      width: 180,
      render: (val: string | null) => val ? (
        <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 11 }}>{val}</Tag>
      ) : (
        <Tag color="default">-</Tag>
      ),
    },
    {
      title: t('koc.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
          {status === 'ACTIVE' ? t('status.active') : t('status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 140,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: KOC) => (
        <Space size="small">
          {isAdmin && (
            <>
              {onCreateAccount && !kocHasAccount?.[record.id] && (
                <Tooltip title={t('kocAccount.createTitle')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<UserAddOutlined style={{ color: '#52c41a' }} />}
                    onClick={() => onCreateAccount(record)}
                    style={{ padding: '4px 8px' }}
                  />
                </Tooltip>
              )}
              {kocHasAccount?.[record.id] && (
                <Tooltip title={t('kocAccount.hasAccount')}>
                  <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                    {t('kocAccount.hasAccountShort')}
                  </Tag>
                </Tooltip>
              )}
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#1677ff' }} />}
                  onClick={() => onEdit(record)}
                  style={{ padding: '4px 8px' }}
                />
              </Tooltip>
              <Popconfirm
                title={t('confirm.delete')}
                onConfirm={() => onDelete(record.id)}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Tooltip title={t('common.delete')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
                    style={{ padding: '4px 8px' }}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table<KOC>
      columns={columns}
      dataSource={kocs}
      rowKey="id"
      loading={loading}
      bordered
      locale={getTableLocale(t)}
      scroll={{ x: 1400 }}
      pagination={
        statusFilter
          ? {
              pageSize,
              showTotal: (t_total) => `${t('common.total')}: ${t_total}`,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              onShowSizeChange: (_, size) => onPageSizeChange(size),
            }
          : {
              current: page,
              pageSize,
              total,
              showTotal: (t_total) => `${t('common.total')}: ${t_total}`,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (p) => onPageChange(p),
              onShowSizeChange: (_, size) => onPageSizeChange(size),
            }
      }
      size="middle"
    />
  );
};

export default KOCTable;
