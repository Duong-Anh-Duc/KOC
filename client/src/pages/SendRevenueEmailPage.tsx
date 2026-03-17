import { useProgress } from '@/hooks/useProgress';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  MailOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailApi, revenueApi } from '../api';
import { toastError, toastSuccess } from '../utils';
import { TaskProgressBar } from '../components/common';
import EmailSendResultModal from '../components/cron/EmailSendResultModal';

const { Title, Text } = Typography;

const SendRevenueEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedKocIds, setSelectedKocIds] = useState<string[]>([]);
  const [kocSearch, setKocSearch] = useState('');
  const [sendResultModal, setSendResultModal] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);

  // Fetch available cycles
  const { data: cyclesRes } = useQuery({
    queryKey: ['email-cycles'],
    queryFn: async () => {
      const res = await emailApi.getCycles();
      return res.data;
    },
  });

  const cycles = cyclesRes?.data || [];
  const selectedCycle = cycles.find((c: any) => c.month === selectedMonth);
  const selectedCycleId = selectedCycle?.id;

  // Fetch KOCs for selected cycle
  const { data: recordsRes, isLoading: recordsLoading } = useQuery({
    queryKey: ['cycle-records-for-email', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return null;
      const res = await revenueApi.getRecordsByCycle(selectedCycleId);
      return res.data;
    },
    enabled: !!selectedCycleId,
  });

  const kocRecords = useMemo(() =>
    (recordsRes?.data || []).filter((r: any) => r.koc),
    [recordsRes]
  );

  const filteredKocRecords = useMemo(() => {
    if (!kocSearch) return kocRecords;
    const search = kocSearch.toLowerCase();
    return kocRecords.filter((r: any) =>
      r.koc.full_name?.toLowerCase().includes(search) ||
      r.koc.channel_name?.toLowerCase().includes(search)
    );
  }, [kocRecords, kocSearch]);

  // SSE Progress
  const emailProgress = useProgress((result: unknown) => {
    const data = result as Record<string, any>;
    if (data) {
      setSendResults(data);
      setSendResultModal(true);
      toastSuccess('emailRevenueSent', t('email.revenueSentSuccess', {
        sent: data.sent?.length || data.summary?.totalSent || 0,
        failed: data.failed?.length || data.summary?.totalFailed || 0,
      }));
    }
    queryClient.invalidateQueries({ queryKey: ['email-cycles'] });
  });

  // Send mutation
  const sendRevenueMutation = useMutation({
    mutationFn: ({ month, kocIds }: { month: string; kocIds?: string[] }) =>
      emailApi.sendRevenueEmails(month, kocIds),
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) emailProgress.startTask(taskId);
    },
    onError: () => {
      toastError('emailRevenueError', t('email.revenueSentFailed'));
    },
  });

  const isSending = sendRevenueMutation.isPending || emailProgress.state.active;

  const handleSend = () => {
    if (!selectedMonth) return;
    const kocIds = selectedKocIds.length > 0 ? selectedKocIds : undefined;
    const kocCount = kocIds?.length;
    const confirmContent = kocCount
      ? t('email.confirmSendSelectedDesc', { month: selectedMonth, count: kocCount })
      : t('email.confirmSendDesc', { month: selectedMonth });

    Modal.confirm({
      title: t('email.confirmSend'),
      content: confirmContent,
      okText: t('email.sendNow'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => sendRevenueMutation.mutate({ month: selectedMonth, kocIds }),
    });
  };

  const handleQuickSend = (month: string) => {
    Modal.confirm({
      title: t('email.confirmSend'),
      content: t('email.confirmSendDesc', { month }),
      okText: t('email.sendNow'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => sendRevenueMutation.mutate({ month }),
    });
  };

  // KOC table row selection
  const rowSelection = {
    selectedRowKeys: selectedKocIds,
    onChange: (keys: React.Key[]) => setSelectedKocIds(keys as string[]),
  };

  const sendButtonLabel = selectedKocIds.length > 0
    ? t('email.sendSelected', { count: selectedKocIds.length })
    : t('email.sendAll');

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SendOutlined style={{ marginRight: 8 }} />
          {t('email.sendRevenuePage')}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('email.sendRevenuePageDesc')}
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left: Cycle list */}
        <Col xs={24} lg={6}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: 13 }}>
                <CalendarOutlined style={{ marginRight: 6 }} />
                {t('email.cycleList')}
              </span>
            }
            styles={{ body: { padding: 0 } }}
          >
            {cycles.length === 0 ? (
              <Empty description={t('common.noData')} style={{ padding: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              cycles.map((c: any) => {
                const isActive = c.month === selectedMonth;
                const statusColor = c.status === 'PAYMENT_COMPLETED' ? 'green'
                  : c.status === 'LOCKED' ? 'orange' : 'blue';
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedMonth(c.month);
                      setSelectedKocIds([]);
                      setKocSearch('');
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderLeft: isActive ? '3px solid #ED8F3A' : '3px solid transparent',
                      background: isActive ? '#fff7ed' : undefined,
                      borderBottom: '1px solid #f5f5f5',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#fafafa'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = ''; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong={isActive} style={{ fontSize: 14 }}>{c.month}</Text>
                      <Tag color={statusColor} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                        {String(t(`status.${c.status}`, c.status))}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <TeamOutlined style={{ marginRight: 3 }} />
                        {c.recordCount} {t('common.kocs')}
                      </Text>
                      <Tooltip title={t('email.sendAll')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<SendOutlined />}
                          loading={isSending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSend(c.month);
                          }}
                          style={{ fontSize: 12, color: '#ED8F3A', padding: '0 4px', height: 22 }}
                        />
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </Col>

        {/* Right: KOC selection & send */}
        <Col xs={24} lg={18}>
          {!selectedMonth ? (
            <Card
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 360,
              }}
              styles={{ body: { textAlign: 'center' } }}
            >
              <MailOutlined style={{ fontSize: 52, color: '#e0e0e0', marginBottom: 16 }} />
              <Title level={5} type="secondary" style={{ margin: 0, fontWeight: 400 }}>
                {t('email.selectCyclePrompt')}
              </Title>
            </Card>
          ) : (
            <>
              {/* Action bar */}
              <Card size="small" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Cycle info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarOutlined style={{ color: '#ED8F3A' }} />
                      <Text strong style={{ fontSize: 16 }}>{selectedMonth}</Text>
                    </div>

                    <div style={{ height: 20, width: 1, background: '#e8e8e8' }} />

                    {/* KOC count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TeamOutlined style={{ color: '#8c8c8c' }} />
                      <Text type="secondary">
                        {selectedKocIds.length > 0
                          ? <><Text strong style={{ color: '#ED8F3A' }}>{selectedKocIds.length}</Text> / {kocRecords.length} {t('common.kocs')}</>
                          : <>{kocRecords.length} {t('common.kocs')}</>
                        }
                      </Text>
                    </div>

                    {selectedKocIds.length > 0 && (
                      <>
                        <div style={{ height: 20, width: 1, background: '#e8e8e8' }} />
                        <Button
                          type="text"
                          size="small"
                          icon={<ClearOutlined />}
                          onClick={() => setSelectedKocIds([])}
                          style={{ color: '#8c8c8c', fontSize: 12 }}
                        >
                          {t('email.clearSelection')}
                        </Button>
                      </>
                    )}
                  </div>

                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={isSending}
                    onClick={handleSend}
                    style={{ background: '#ED8F3A', borderColor: '#ED8F3A' }}
                  >
                    {sendButtonLabel}
                  </Button>
                </div>
              </Card>

              {/* Progress */}
              <TaskProgressBar state={emailProgress.state} onDismiss={emailProgress.reset} />

              {/* KOC Table */}
              <Card
                size="small"
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13 }}>
                      <TeamOutlined style={{ marginRight: 6 }} />
                      {t('email.kocList')}
                    </span>
                    <Input
                      placeholder={t('email.searchKoc')}
                      prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                      value={kocSearch}
                      onChange={(e) => setKocSearch(e.target.value)}
                      allowClear
                      size="small"
                      style={{ maxWidth: 240 }}
                    />
                  </div>
                }
              >
                <Table
                  dataSource={filteredKocRecords}
                  rowKey="koc_id"
                  size="small"
                  loading={recordsLoading}
                  rowSelection={rowSelection}
                  pagination={kocRecords.length > 15 ? { pageSize: 15, size: 'small', showSizeChanger: false } : false}
                  columns={[
                    {
                      title: t('email.kocName'),
                      dataIndex: ['koc', 'full_name'],
                      ellipsis: true,
                      render: (name: string, record: any) => (
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>{record.koc?.channel_name}</Text>
                        </div>
                      ),
                    },
                    {
                      title: t('email.revenueUsd'),
                      dataIndex: 'original_revenue_usd',
                      width: 140,
                      align: 'right' as const,
                      render: (val: any) => {
                        const num = Number(val || 0);
                        return (
                          <Text strong style={{ color: num >= 100 ? '#52c41a' : '#faad14' }}>
                            ${num.toFixed(2)}
                          </Text>
                        );
                      },
                      sorter: (a: any, b: any) => Number(a.original_revenue_usd) - Number(b.original_revenue_usd),
                      defaultSortOrder: 'descend' as const,
                    },
                    {
                      title: t('common.status'),
                      dataIndex: 'status',
                      width: 110,
                      align: 'center' as const,
                      render: (status: string) => {
                        const color = status === 'PAID' ? 'green' : status === 'APPROVED' ? 'blue' : 'orange';
                        return <Tag color={color} style={{ margin: 0 }}>{String(t(`status.${status}`, status))}</Tag>;
                      },
                      filters: [
                        { text: String(t('status.PENDING', 'PENDING')), value: 'PENDING' },
                        { text: String(t('status.APPROVED', 'APPROVED')), value: 'APPROVED' },
                        { text: String(t('status.PAID', 'PAID')), value: 'PAID' },
                      ],
                      onFilter: (value: any, record: any) => record.status === value,
                    },
                  ]}
                />
              </Card>
            </>
          )}
        </Col>
      </Row>

      {/* Send Results Modal */}
      <EmailSendResultModal
        open={sendResultModal}
        onClose={() => setSendResultModal(false)}
        sendResults={sendResults}
      />
    </div>
  );
};

export default SendRevenueEmailPage;
