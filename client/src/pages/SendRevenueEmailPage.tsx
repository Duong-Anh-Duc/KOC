import { useProgress } from '@/hooks/useProgress';
import { SendOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Modal, Row, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailApi, revenueApi } from '../api';
import EmailSendResultModal from '../components/cron/EmailSendResultModal';
import CycleListPanel from '../components/sendEmail/CycleListPanel';
import KocSelectionPanel from '../components/sendEmail/KocSelectionPanel';
import { toastError, toastSuccess } from '../utils';

const { Title, Text } = Typography;

const SendRevenueEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedKocIds, setSelectedKocIds] = useState<string[]>([]);
  const [kocSearch, setKocSearch] = useState('');
  const [sendResultModal, setSendResultModal] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);

  const { data: cyclesRes } = useQuery({
    queryKey: ['email-cycles'],
    queryFn: async () => (await emailApi.getCycles()).data,
  });

  const cycles = cyclesRes?.data || [];
  const selectedCycleId = cycles.find((c: any) => c.month === selectedMonth)?.id;

  const { data: recordsRes, isLoading: recordsLoading } = useQuery({
    queryKey: ['cycle-records-for-email', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return null;
      return (await revenueApi.getRecordsByCycle(selectedCycleId)).data;
    },
    enabled: !!selectedCycleId,
  });

  const kocRecords = useMemo(() => (recordsRes?.data || []).filter((r: any) => r.koc), [recordsRes]);

  const filteredKocRecords = useMemo(() => {
    if (!kocSearch) return kocRecords;
    const q = kocSearch.toLowerCase();
    return kocRecords.filter((r: any) =>
      r.koc.full_name?.toLowerCase().includes(q) || r.koc.channel_name?.toLowerCase().includes(q)
    );
  }, [kocRecords, kocSearch]);

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

  const sendRevenueMutation = useMutation({
    mutationFn: ({ month, kocIds }: { month: string; kocIds?: string[] }) =>
      emailApi.sendRevenueEmails(month, kocIds),
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) emailProgress.startTask(taskId);
    },
    onError: () => toastError('emailRevenueError', t('email.revenueSentFailed')),
  });

  const isSending = sendRevenueMutation.isPending || emailProgress.state.active;

  const confirmAndSend = (month: string, kocIds?: string[]) => {
    const confirmContent = kocIds?.length
      ? t('email.confirmSendSelectedDesc', { month, count: kocIds.length })
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

  const handleSend = () => {
    if (!selectedMonth) return;
    confirmAndSend(selectedMonth, selectedKocIds.length > 0 ? selectedKocIds : undefined);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SendOutlined style={{ marginRight: 8 }} />
          {t('email.sendRevenuePage')}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>{t('email.sendRevenuePageDesc')}</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <CycleListPanel
            cycles={cycles}
            selectedMonth={selectedMonth}
            isSending={isSending}
            onSelectCycle={(month) => { setSelectedMonth(month); setSelectedKocIds([]); setKocSearch(''); }}
            onQuickSend={(month) => confirmAndSend(month)}
          />
        </Col>
        <Col xs={24} lg={18}>
          <KocSelectionPanel
            selectedMonth={selectedMonth}
            kocRecords={kocRecords}
            filteredKocRecords={filteredKocRecords}
            selectedKocIds={selectedKocIds}
            kocSearch={kocSearch}
            isSending={isSending}
            recordsLoading={recordsLoading}
            progressState={emailProgress.state}
            onKocSearchChange={setKocSearch}
            onSelectionChange={setSelectedKocIds}
            onClearSelection={() => setSelectedKocIds([])}
            onSend={handleSend}
            onDismissProgress={emailProgress.reset}
          />
        </Col>
      </Row>

      <EmailSendResultModal
        open={sendResultModal}
        onClose={() => setSendResultModal(false)}
        sendResults={sendResults}
      />
    </div>
  );
};

export default SendRevenueEmailPage;
