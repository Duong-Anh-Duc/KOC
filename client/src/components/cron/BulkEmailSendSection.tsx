import { useProgress } from '@/hooks/useProgress';
import { MailOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Divider,
  Modal,
  Row,
  Table,
  Typography
} from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailApi, revenueApi } from '../../api';
import { toastError, toastSuccess } from '../../utils';
import { AppTag, NativeMultiSelect, NativeSelect, TaskProgressBar } from '../common';

const { Text, Title } = Typography;

interface BulkEmailSendSectionProps {
  onSendingChange?: (isSending: boolean) => void;
  onSendComplete: (results: any) => void;
}

const BulkEmailSendSection: React.FC<BulkEmailSendSectionProps> = ({ onSendingChange, onSendComplete }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedKocIds, setSelectedKocIds] = useState<string[]>([]);

  // Fetch available cycles
  const { data: cyclesRes } = useQuery({
    queryKey: ['email-cycles'],
    queryFn: async () => {
      const res = await emailApi.getCycles();
      return res.data;
    },
  });

  const cycles = cyclesRes?.data || [];

  // Find cycleId from selected month
  const selectedCycle = cycles.find((c: any) => c.month === selectedMonth);
  const selectedCycleId = selectedCycle?.id;

  // Fetch KOCs for selected cycle
  const { data: recordsRes } = useQuery({
    queryKey: ['cycle-records-for-email', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return null;
      const res = await revenueApi.getRecordsByCycle(selectedCycleId);
      return res.data;
    },
    enabled: !!selectedCycleId,
  });

  const kocOptions = (recordsRes?.data || [])
    .filter((r: any) => r.koc)
    .map((r: any) => ({
      value: r.koc_id,
      label: `${r.koc.full_name} (${r.koc.channel_name || ''})`,
    }));

  // SSE Progress for sending revenue emails
  const emailProgress = useProgress((result: unknown) => {
    onSendingChange?.(false);
    const data = result as Record<string, any>;
    if (data) {
      onSendComplete(data);
      toastSuccess('emailRevenueSent', t('email.revenueSentSuccess', {
        sent: data.sent?.length || data.summary?.totalSent || 0,
        failed: data.failed?.length || data.summary?.totalFailed || 0,
      }));
    }
    queryClient.invalidateQueries({ queryKey: ['email-cycles'] });
  });

  // Send revenue emails mutation
  const sendRevenueMutation = useMutation({
    mutationFn: ({ month, kocIds }: { month: string; kocIds?: string[] }) => {
      onSendingChange?.(true);
      return emailApi.sendRevenueEmails(month, kocIds);
    },
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) {
        emailProgress.startTask(taskId);
      } else {
        onSendingChange?.(false);
      }
    },
    onError: () => {
      onSendingChange?.(false);
      toastError('emailRevenueError', t('email.revenueSentFailed'));
    },
  });

  const handleSend = (month: string, kocIds?: string[]) => {
    const kocCount = kocIds && kocIds.length > 0 ? kocIds.length : undefined;
    const confirmContent = kocCount
      ? t('email.confirmSendSelectedDesc', { month, count: kocCount })
      : t('email.confirmSendDesc', { month });

    Modal.confirm({
      title: t('email.confirmSend'),
      content: confirmContent,
      okText: t('email.sendNow'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => sendRevenueMutation.mutate({ month, kocIds }),
    });
  };

  const isSending = sendRevenueMutation.isPending || emailProgress.state.active;

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={5} style={{ margin: 0 }}>
          <MailOutlined style={{ marginRight: 8 }} />
          {t('email.sendRevenueTitle')}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('email.sendRevenueDesc')}
        </Text>
      </div>

      {/* Send Form */}
      <div style={{
        background: '#fafafa',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20,
      }}>
        <Row gutter={[16, 16]}>
          {/* Cycle Selection */}
          <Col xs={24} md={selectedMonth ? 12 : 24}>
            <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
              {t('email.selectCycle')}
            </Text>
            {/* AntD-original:
            <Select
              placeholder={t('email.selectCyclePlaceholder')}
              value={selectedMonth || undefined}
              onChange={(val) => {
                setSelectedMonth(val);
                setSelectedKocIds([]);
              }}
              style={{ width: '100%' }}
              options={cycles.map((c: any) => ({
                value: c.month,
                label: `${c.month} - ${c.status} (${c.recordCount} ${t('email.records')})`,
              }))}
            />
            */}
            <NativeSelect
              placeholder={t('email.selectCyclePlaceholder')}
              value={selectedMonth || undefined}
              onChange={(val) => {
                setSelectedMonth(val || '');
                setSelectedKocIds([]);
              }}
              style={{ width: '100%' }}
              options={cycles.map((c: any) => ({
                value: c.month,
                label: `${c.month} - ${c.status} (${c.recordCount} ${t('email.records')})`,
              }))}
              allowClear
            />
          </Col>

          {/* KOC Selection */}
          {selectedMonth && kocOptions.length > 0 && (
            <Col xs={24} md={12}>
              <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                <TeamOutlined style={{ marginRight: 4 }} />
                {t('email.selectKoc')}
              </Text>
              {/* AntD-original:
              <Select
                mode="multiple"
                allowClear
                placeholder={t('email.selectKocPlaceholder')}
                value={selectedKocIds}
                onChange={setSelectedKocIds}
                style={{ width: '100%' }}
                options={kocOptions}
                maxTagCount="responsive"
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
              */}
              <NativeMultiSelect
                placeholder={t('email.selectKocPlaceholder')}
                value={selectedKocIds}
                onChange={setSelectedKocIds}
                style={{ width: '100%' }}
                options={kocOptions}
              />
            </Col>
          )}
        </Row>

        {/* Send Button */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="primary"
            danger
            icon={<SendOutlined />}
            loading={isSending}
            onClick={() => {
              if (selectedMonth) {
                handleSend(selectedMonth, selectedKocIds.length > 0 ? selectedKocIds : undefined);
              }
            }}
            disabled={!selectedMonth}
            size="middle"
          >
            {selectedKocIds.length > 0
              ? t('email.sendSelected', { count: selectedKocIds.length })
              : t('email.sendAll')}
          </Button>
          {selectedMonth && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedKocIds.length > 0
                ? `${selectedKocIds.length} / ${kocOptions.length} ${t('common.kocs')}`
                : `${selectedCycle?.recordCount || kocOptions.length} ${t('common.kocs')}`}
            </Text>
          )}
        </div>
      </div>

      {/* Progress */}
      <TaskProgressBar state={emailProgress.state} onDismiss={emailProgress.reset} />

      {/* Cycles Table */}
      {cycles.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 12px' }} />
          <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>
            {t('email.cycleList', 'Danh sách chu kỳ')}
          </Text>
          <Table
            dataSource={cycles}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: t('email.month'),
                dataIndex: 'month',
                width: 100,
              },
              {
                title: t('common.status'),
                dataIndex: 'status',
                width: 110,
                render: (status: string) => {
                  const color = status === 'PAYMENT_COMPLETED' ? 'green' : status === 'LOCKED' ? 'orange' : 'blue';
                  return <AppTag color={color}>{t(`status.${status}`, status)}</AppTag>;
                },
              },
              {
                title: t('email.records'),
                dataIndex: 'recordCount',
                width: 80,
                align: 'center' as const,
              },
              {
                title: t('common.actions'),
                width: 120,
                align: 'center' as const,
                render: (_: any, record: any) => (
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<SendOutlined />}
                    loading={isSending}
                    onClick={() => handleSend(record.month)}
                  >
                    {t('email.send')}
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
};

export default BulkEmailSendSection;
