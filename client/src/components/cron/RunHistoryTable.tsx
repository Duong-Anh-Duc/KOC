import { CheckCircleOutlined, CloseCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { Card, Space, Table, Tag, Tooltip } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCronResult } from '../../utils/cronResultFormatter';

interface RunHistoryTableProps {
  runHistory: any[];
}

const RunHistoryTable: React.FC<RunHistoryTableProps> = ({ runHistory }) => {
  const { t } = useTranslation();

  const historyColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('cron.runTime'),
      dataIndex: 'runAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: t('common.status'),
      dataIndex: 'success',
      width: 100,
      align: 'center' as const,
      render: (val: boolean) => (
        <Tag color={val ? 'success' : 'error'} icon={val ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {val ? t('cron.success') : t('cron.failed')}
        </Tag>
      ),
    },
    {
      title: t('cron.targetMonth'),
      dataIndex: 'cycleMonth',
      width: 120,
      align: 'center' as const,
      render: (val?: string) => val || '-',
    },
    {
      title: t('cron.resultMessage'),
      dataIndex: 'message',
      render: (val: string) => {
        const translatedMessage = formatCronResult(val, t);
        // If message is too long, show it in a tooltip
        if (translatedMessage.length > 80) {
          return (
            <Tooltip title={translatedMessage}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {translatedMessage}
              </div>
            </Tooltip>
          );
        }
        return translatedMessage;
      },
    },
  ];

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined />
          {t('cron.runHistory')}
        </Space>
      }
    >
      <Table
        columns={historyColumns}
        dataSource={runHistory}
        rowKey={(_, index) => String(index)}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${t('common.total')}: ${total}`,
        }}
        bordered
        size="small"
        locale={{
          emptyText: t('cron.noRunHistory'),
        }}
      />
    </Card>
  );
};

export default RunHistoryTable;
