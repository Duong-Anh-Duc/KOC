import { AuditOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auditApi } from '../api';
import { AuditDetailModal, AuditLogsHeader, AuditLogsTable } from '../components/auditLogs';
import { SummaryBar } from '../components/common';
import type { AuditLog } from '../types';

const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize, entityFilter, actionFilter, dateRange],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: pageSize };
      if (entityFilter) params.entity = entityFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await auditApi.getLogs(params as { page?: number; limit?: number; entity?: string });
      return res.data;
    },
  });

  const logs = data?.data || [];
  const pagination = data?.meta;

  return (
    <div>
      <AuditLogsHeader
        dateRange={dateRange}
        onDateRangeChange={(dates) => { setDateRange(dates); setPage(1); }}
        entityFilter={entityFilter}
        onEntityFilterChange={(val) => { setEntityFilter(val); setPage(1); }}
        actionFilter={actionFilter}
        onActionFilterChange={(val) => { setActionFilter(val); setPage(1); }}
        onRefresh={() => refetch()}
      />

      <SummaryBar
        items={[
          {
            title: t('audit.totalLogs'),
            value: pagination?.total || 0,
            prefix: <AuditOutlined />,
            valueStyle: { color: '#1677ff' },
          },
          {
            title: t('audit.uniqueUsers'),
            value: new Set(logs.map((l) => l.user_id)).size,
            prefix: <UserOutlined />,
            valueStyle: { color: '#52c41a' },
          },
          {
            title: t('audit.todayLogs'),
            value: logs.filter((l) => dayjs(l.timestamp).isAfter(dayjs().startOf('day'))).length,
            prefix: <FileTextOutlined />,
            valueStyle: { color: '#fa8c16' },
          },
        ]}
        loading={isLoading}
      />

      <AuditLogsTable
        logs={logs}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={pagination?.total || 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onViewDetails={(log) => setSelectedLog(log)}
      />

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
};

export default AuditLogsPage;
