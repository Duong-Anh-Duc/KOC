import { CalendarOutlined, SendOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Tag, Tooltip, Typography } from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface CycleItem {
  id: string | number;
  month: string;
  status: string;
  recordCount: number;
}

interface Props {
  cycles: CycleItem[];
  selectedMonth: string;
  isSending: boolean;
  onSelectCycle: (month: string) => void;
  onQuickSend: (month: string) => void;
}

const CycleListPanel: React.FC<Props> = ({ cycles, selectedMonth, isSending, onSelectCycle, onQuickSend }) => {
  const { t } = useTranslation();

  return (
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
        cycles.map((c) => {
          const isActive = c.month === selectedMonth;
          const statusColor = c.status === 'PAYMENT_COMPLETED' ? 'green'
            : c.status === 'LOCKED' ? 'orange' : 'blue';
          return (
            <div
              key={c.id}
              onClick={() => onSelectCycle(c.month)}
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
                <AppTag color={statusColor} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                  {String(t(`status.${c.status}`, c.status))}
                </AppTag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <TeamOutlined style={{ marginRight: 3 }} />
                  {c.recordCount} {t('common.kocs')}
                </Text>
                <AppTooltip title={t('email.sendAll')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<SendOutlined />}
                    loading={isSending}
                    onClick={(e) => { e.stopPropagation(); onQuickSend(c.month); }}
                    style={{ fontSize: 12, color: '#ED8F3A', padding: '0 4px', height: 22 }}
                  />
                </AppTooltip>
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
};

export default CycleListPanel;
