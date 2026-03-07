import { CopyOutlined, DeleteOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { KOC } from '../../types';
import { getTableLocale } from '../../utils';

const { Text } = Typography;

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
  onDuplicate: (koc: KOC) => void;
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
  onDuplicate,
  onDelete,
  onCreateAccount,
  kocHasAccount,
}) => {
  const { t } = useTranslation();
  const darkMode = useAppStore((s) => s.darkMode);

  const columns: ColumnsType<KOC> = [
    {
      title: t('common.stt'),
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: t('koc.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 160,
      sorter: true,
      ellipsis: { showTitle: false },
      render: (val: string) => (
        <Tooltip title={val} placement="topLeft">
          <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '-'}</Text>
        </Tooltip>
      ),
    },
    {
      title: t('koc.channelName'),
      dataIndex: 'channel_name',
      key: 'channel_name',
      width: 150,
      ellipsis: { showTitle: false },
      render: (val: string) => val ? (
        <Tooltip title={val} placement="topLeft">
          <Text style={{ color: '#1677ff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</Text>
        </Tooltip>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('koc.email'),
      dataIndex: 'email',
      key: 'email',
      width: 190,
      ellipsis: { showTitle: false },
      render: (val: string) => val ? (
        <Tooltip title={val} placement="topLeft">
          <Text style={{ fontSize: 12, color: darkMode ? '#d9d9d9' : '#434343', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</Text>
        </Tooltip>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('koc.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (val: string) => val ? (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{val}</Text>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('koc.bankName'),
      dataIndex: 'bank_name',
      key: 'bank_name',
      width: 140,
      ellipsis: { showTitle: false },
      render: (val: string) => val ? (
        <Tooltip title={val} placement="topLeft">
          <Text style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</Text>
        </Tooltip>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('koc.bankAccount'),
      dataIndex: 'bank_account_number',
      key: 'bank_account_number',
      width: 150,
      render: (val: string | null) => val ? (
        <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11, margin: 0 }}>{val}</Tag>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('koc.baseRate'),
      dataIndex: 'base_rate',
      key: 'base_rate',
      width: 90,
      align: 'center',
      render: (val: number) => (
        <Tag color="cyan" style={{ fontWeight: 600, minWidth: 40, textAlign: 'center' }}>
          {`${(Number(val) * 100).toFixed(0)}%`}
        </Tag>
      ),
    },
    {
      title: t('koc.pubCode'),
      dataIndex: 'pub_code',
      key: 'pub_code',
      width: 180,
      ellipsis: { showTitle: false },
      render: (val: string | null) => val ? (
        <Tooltip title={val}>
          <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 11, cursor: 'default', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{val}</Tag>
        </Tooltip>
      ) : (
        <Text type="secondary">-</Text>
      ),
    },
    {
      title: t('koc.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag
          color={status === 'ACTIVE' ? 'success' : 'default'}
          style={{ fontWeight: 600, minWidth: 60, textAlign: 'center', borderRadius: 12 }}
        >
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
              <Tooltip title="Nhân bản KOC">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined style={{ color: '#fa8c16' }} />}
                  onClick={() => onDuplicate(record)}
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
      onRow={(_, index) => {
        const bgColor = darkMode
          ? ((index ?? 0) % 2 === 0 ? '#141414' : '#1f1f1f')
          : ((index ?? 0) % 2 === 0 ? '#ffffff' : '#f7f9ff');
        const hoverBgColor = darkMode ? '#262626' : '#e6f4ff';

        return {
          style: {
            backgroundColor: bgColor,
            transition: 'background-color 0.15s',
          },
          onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = hoverBgColor; },
          onMouseLeave: (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = bgColor; },
        };
      }}
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
      size="small"
      style={{ borderRadius: 8 }}
    />
  );
};

export default KOCTable;
