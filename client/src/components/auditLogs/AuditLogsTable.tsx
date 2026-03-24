import { EyeOutlined } from '@ant-design/icons';
import { Button, Grid, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AuditLog } from '../../types';
import { getTableLocale } from '../../utils';

const { useBreakpoint } = Grid;

const entityColorMap: Record<string, string> = {
  KOC: 'blue',
  REVENUE_RECORD: 'green',
  REVENUE_CYCLE: 'orange',
  USER: 'purple',
  CHANNEL_STAT: 'cyan',
  SYSTEM_CONFIG: 'magenta',
};

interface AuditLogsTableProps {
  logs: AuditLog[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onViewDetails: (log: AuditLog) => void;
}

const AuditLogsTable: React.FC<AuditLogsTableProps> = ({
  logs,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  onViewDetails,
}) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const columns: ColumnsType<AuditLog> = [
    {
      title: t('common.stt'),
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: t('audit.action'),
      dataIndex: 'action',
      width: 180,
      render: (action: string) => {
        const colorMap: Record<string, string> = {
          CREATE: 'green',
          UPDATE: 'blue',
          DELETE: 'red',
          APPROVE: 'orange',
          APPROVE_REVENUE_RECORD: 'orange',
          UNAPPROVE_REVENUE_RECORD: 'volcano',
          LOCK: 'purple',
          LOCK_CYCLE: 'purple',
          REOPEN_CYCLE: 'cyan',
          COMPLETE: 'cyan',
          COMPLETE_CYCLE: 'cyan',
          LOGIN: 'geekblue',
          CREATE_CYCLE: 'green',
          RUN_CRON_JOB: 'gold',
          UPDATE_CRON_CONFIG: 'blue',
          SCRAPE_REVENUE: 'lime',
          SEND_REVENUE_EMAILS: 'geekblue',
        };
        return <Tag color={colorMap[action] || 'default'}>{t(`audit.actions.${action}`, action)}</Tag>;
      },
    },
    {
      title: t('audit.entity'),
      dataIndex: 'entity',
      width: 140,
      render: (val: string) => (
        <Tag color={entityColorMap[val] || 'default'}>{t(`audit.entities.${val}`, val)}</Tag>
      ),
    },
    {
      title: t('audit.user'),
      width: 180,
      responsive: ['sm'],
      render: (_: unknown, record: AuditLog) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.user?.full_name || '-'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{record.user?.email || '-'}</div>
        </div>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'timestamp',
      width: 160,
      responsive: ['md'],
      render: (val: string) => (
        <div>
          <div>{dayjs(val).format('DD/MM/YYYY')}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{dayjs(val).format('HH:mm:ss')}</div>
        </div>
      ),
    },
    {
      title: t('common.actions'),
      width: 100,
      align: 'center',
      render: (_: unknown, record: AuditLog) => (
        <Tooltip title={t('common.viewDetails')}>
          <Button
            type="text"
            size="small"
            className="audit-eye-btn"
            icon={<EyeOutlined />}
            onClick={() => onViewDetails(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={logs}
      rowKey="id"
      loading={loading}
      bordered
      locale={getTableLocale(t)}
      scroll={{ x: isMobile ? 'max-content' : 1000 }}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: (p) => onPageChange(p),
        onShowSizeChange: (_, size) => onPageSizeChange(size),
        showTotal: (t_total) => `${t('common.total')}: ${t_total}`,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: ['10', '20', '50', '100'],
      }}
    />
  );
};

export default AuditLogsTable;
