import {
  CalendarOutlined,
  ClearOutlined,
  MailOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Input, Table, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TaskProgressBar } from '../common';
import type { ProgressState } from '../../hooks/useProgress';
const { Text } = Typography;

interface KocRecord {
  koc_id: string;
  koc: { full_name: string; channel_name: string };
  original_revenue_usd: any;
  status: string;
}

interface Props {
  selectedMonth: string;
  kocRecords: KocRecord[];
  filteredKocRecords: KocRecord[];
  selectedKocIds: string[];
  kocSearch: string;
  isSending: boolean;
  recordsLoading: boolean;
  progressState: ProgressState;
  onKocSearchChange: (val: string) => void;
  onSelectionChange: (keys: string[]) => void;
  onClearSelection: () => void;
  onSend: () => void;
  onDismissProgress: () => void;
}

const KocSelectionPanel: React.FC<Props> = ({
  selectedMonth, kocRecords, filteredKocRecords, selectedKocIds, kocSearch,
  isSending, recordsLoading, progressState,
  onKocSearchChange, onSelectionChange, onClearSelection, onSend, onDismissProgress,
}) => {
  const { t } = useTranslation();

  if (!selectedMonth) {
    return (
      <Card
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}
        styles={{ body: { textAlign: 'center' } }}
      >
        <MailOutlined style={{ fontSize: 52, color: '#e0e0e0', marginBottom: 16 }} />
        <Text type="secondary" style={{ display: 'block', margin: 0 }}>
          {t('email.selectCyclePrompt')}
        </Text>
      </Card>
    );
  }

  const sendButtonLabel = selectedKocIds.length > 0
    ? t('email.sendSelected', { count: selectedKocIds.length })
    : t('email.sendAll');

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarOutlined style={{ color: '#ED8F3A' }} />
              <Text strong style={{ fontSize: 16 }}>{selectedMonth}</Text>
            </div>
            <div style={{ height: 20, width: 1, background: '#e8e8e8' }} />
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
                <Button type="text" size="small" icon={<ClearOutlined />} onClick={onClearSelection} style={{ color: '#8c8c8c', fontSize: 12 }}>
                  {t('email.clearSelection')}
                </Button>
              </>
            )}
          </div>
          <Button type="primary" icon={<SendOutlined />} loading={isSending} onClick={onSend} style={{ background: '#ED8F3A', borderColor: '#ED8F3A' }}>
            {sendButtonLabel}
          </Button>
        </div>
      </Card>

      <TaskProgressBar state={progressState} onDismiss={onDismissProgress} />

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
              onChange={(e) => onKocSearchChange(e.target.value)}
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
          rowSelection={{
            selectedRowKeys: selectedKocIds,
            onChange: (keys) => onSelectionChange(keys as string[]),
          }}
          pagination={kocRecords.length > 15 ? { pageSize: 15, size: 'small', showSizeChanger: false } : false}
          columns={[
            {
              title: t('email.kocName'),
              dataIndex: ['koc', 'full_name'],
              ellipsis: true,
              render: (name: string, record: KocRecord) => (
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
                return <Text strong style={{ color: num >= 100 ? '#52c41a' : '#faad14' }}>${num.toFixed(2)}</Text>;
              },
              sorter: (a: KocRecord, b: KocRecord) => Number(a.original_revenue_usd) - Number(b.original_revenue_usd),
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
              onFilter: (value: any, record: KocRecord) => record.status === value,
            },
          ]}
        />
      </Card>
    </>
  );
};

export default KocSelectionPanel;
