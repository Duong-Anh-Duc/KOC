import { useProgress } from '@/hooks/useProgress';
import { SendOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailApi, revenueApi } from '../../api';
import { toastError, toastSuccess } from '../../utils';
import { TaskProgressBar } from '../common';

const { Text } = Typography;

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
  const selectedCycleId = cycles.find((c: any) => c.month === selectedMonth)?.id;

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

  return (
    <Card
      title={
        <Space>
          <SendOutlined />
          {t('email.sendRevenueTitle')}
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Alert
        type="info"
        showIcon
        message={t('email.sendRevenueDesc')}
        style={{ marginBottom: 16 }}
      />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {t('email.selectCycle')}
      </Text>
      <Select
        placeholder={t('email.selectCyclePlaceholder')}
        value={selectedMonth || undefined}
        onChange={(val) => {
          setSelectedMonth(val);
          setSelectedKocIds([]);
        }}
        style={{ width: '100%', marginBottom: 12 }}
        options={cycles.map((c: any) => ({
          value: c.month,
          label: `${c.month} - ${c.status} (${c.recordCount} ${t('email.records')})`,
        }))}
      />

      {selectedMonth && kocOptions.length > 0 && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {t('email.selectKoc', 'Chọn KOC (bỏ trống = gửi tất cả)')}
          </Text>
          <Select
            mode="multiple"
            allowClear
            placeholder={t('email.selectKocPlaceholder', 'Tất cả KOC trong cycle')}
            value={selectedKocIds}
            onChange={setSelectedKocIds}
            style={{ width: '100%', marginBottom: 12 }}
            options={kocOptions}
            maxTagCount="responsive"
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </>
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          danger
          icon={<SendOutlined />}
          loading={sendRevenueMutation.isPending || emailProgress.state.active}
          onClick={() => {
            if (selectedMonth) {
              handleSend(selectedMonth, selectedKocIds.length > 0 ? selectedKocIds : undefined);
            }
          }}
          disabled={!selectedMonth}
        >
          {selectedKocIds.length > 0
            ? t('email.sendSelected', `Gửi {{count}} KOC`, { count: selectedKocIds.length })
            : t('email.sendAll')}
        </Button>
      </Space>

      {/* SSE Progress Bar for email sending */}
      <TaskProgressBar state={emailProgress.state} onDismiss={emailProgress.reset} />

      {/* Cycle records preview */}
      {cycles.length > 0 && (
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
              width: 100,
              render: (status: string) => {
                const color = status === 'PAYMENT_COMPLETED' ? 'green' : status === 'LOCKED' ? 'orange' : 'blue';
                return <Tag color={color}>{t(`status.${status}`, status)}</Tag>;
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
              width: 100,
              render: (_: any, record: any) => (
                <Button
                  type="link"
                  size="small"
                  icon={<SendOutlined />}
                  loading={sendRevenueMutation.isPending}
                  onClick={() => handleSend(record.month)}
                >
                  {t('email.send')}
                </Button>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
};

export default BulkEmailSendSection;
