import { useProgress } from '@/hooks/useProgress';
import { SendOutlined } from '@ant-design/icons';
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
import { emailApi } from '../../api';
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

  // Fetch available cycles
  const { data: cyclesRes } = useQuery({
    queryKey: ['email-cycles'],
    queryFn: async () => {
      const res = await emailApi.getCycles();
      return res.data;
    },
  });

  const cycles = cyclesRes?.data || [];

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
    mutationFn: (month: string) => {
      onSendingChange?.(true);
      return emailApi.sendRevenueEmails(month);
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
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Select
          placeholder={t('email.selectCyclePlaceholder')}
          value={selectedMonth || undefined}
          onChange={setSelectedMonth}
          style={{ flex: 1 }}
          options={cycles.map((c: any) => ({
            value: c.month,
            label: `${c.month} - ${c.status} (${c.recordCount} ${t('email.records')})`,
          }))}
        />
        <Button
          type="primary"
          danger
          icon={<SendOutlined />}
          loading={sendRevenueMutation.isPending || emailProgress.state.active}
          onClick={() => {
            if (selectedMonth) {
              Modal.confirm({
                title: t('email.confirmSend'),
                content: t('email.confirmSendDesc', { month: selectedMonth }),
                okText: t('email.sendNow'),
                cancelText: t('common.cancel'),
                okButtonProps: { danger: true },
                onOk: () => sendRevenueMutation.mutate(selectedMonth),
              });
            }
          }}
          disabled={!selectedMonth}
        >
          {t('email.sendAll')}
        </Button>
      </Space.Compact>

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
                  onClick={() => {
                    Modal.confirm({
                      title: t('email.confirmSend'),
                      content: t('email.confirmSendDesc', { month: record.month }),
                      okText: t('email.sendNow'),
                      cancelText: t('common.cancel'),
                      okButtonProps: { danger: true },
                      onOk: () => sendRevenueMutation.mutate(record.month),
                    });
                  }}
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
