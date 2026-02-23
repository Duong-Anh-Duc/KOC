import {
    BankOutlined,
    CheckCircleOutlined,
    DollarOutlined,
    FileTextOutlined,
    MonitorOutlined,
    SendOutlined,
} from '@ant-design/icons';
import { Card, Steps, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * Determines the next business day (skip Sat/Sun) from a given date.
 */
function getBusinessDay(year: number, month: number, targetDay: number): Date {
  const date = new Date(year, month, targetDay);
  const dow = date.getDay();
  if (dow === 0) date.setDate(date.getDate() + 1); // Sunday → Monday
  if (dow === 6) date.setDate(date.getDate() + 2); // Saturday → Monday
  return date;
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
  });
}

interface WorkflowTimelineProps {
  cycleMonth?: string; // "MM/YYYY"
  cycleStatus?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED';
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ cycleMonth, cycleStatus }) => {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();

  const { currentStep, steps } = useMemo(() => {
    // Parse cycle month or use current month
    let targetMonth = currentMonth;
    let targetYear = currentYear;
    if (cycleMonth) {
      const [mm, yyyy] = cycleMonth.split('/');
      targetMonth = parseInt(mm, 10) - 1;
      targetYear = parseInt(yyyy, 10);
    }

    const day10 = getBusinessDay(targetYear, targetMonth, 10);
    const day15 = getBusinessDay(targetYear, targetMonth, 15);
    const day22 = getBusinessDay(targetYear, targetMonth, 22);
    const day25 = getBusinessDay(targetYear, targetMonth, 25);
    const locale = i18n.language;

    const stepsData = [
      {
        title: t('workflow.revenueDisplay'),
        description: `${t('workflow.day')} 10 (${formatDate(day10, locale)})`,
        icon: <MonitorOutlined />,
      },
      {
        title: t('workflow.sendReconciliation'),
        description: `${t('workflow.day')} 15 (${formatDate(day15, locale)})`,
        icon: <SendOutlined />,
      },
      {
        title: t('workflow.revenueReceived'),
        description: `${t('workflow.day')} 22 (${formatDate(day22, locale)})`,
        icon: <BankOutlined />,
      },
      {
        title: t('workflow.payPartners'),
        description: `${t('workflow.day')} 25 (${formatDate(day25, locale)})`,
        icon: <DollarOutlined />,
      },
    ];

    // Determine current step based on cycle status and date
    let step = 0;
    const isCurrentMonth = targetMonth === currentMonth && targetYear === currentYear;

    if (cycleStatus === 'PAYMENT_COMPLETED') {
      step = 4; // All done
    } else if (cycleStatus === 'LOCKED') {
      // Locked = reconciliation sent, waiting for payment
      if (isCurrentMonth && currentDay >= 25) step = 3;
      else if (isCurrentMonth && currentDay >= 22) step = 2;
      else step = 1;
    } else if (isCurrentMonth) {
      if (currentDay >= 25) step = 3;
      else if (currentDay >= 22) step = 2;
      else if (currentDay >= 15) step = 1;
      else if (currentDay >= 10) step = 0;
      else step = -1; // Before the 10th
    }

    return { currentStep: step, steps: stepsData };
  }, [cycleMonth, cycleStatus, currentDay, currentMonth, currentYear, t, i18n.language]);

  const getStatusTag = () => {
    if (cycleStatus === 'PAYMENT_COMPLETED') {
      return <Tag icon={<CheckCircleOutlined />} color="success">{t('workflow.completed')}</Tag>;
    }
    if (cycleStatus === 'LOCKED') {
      return <Tag icon={<FileTextOutlined />} color="warning">{t('workflow.reconciliationSent')}</Tag>;
    }
    if (currentStep < 0) {
      return <Tag color="default">{t('workflow.waitingForRevenue')}</Tag>;
    }
    return <Tag color="processing">{t('workflow.inProgress')}</Tag>;
  };

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('workflow.monthlyProcess')}
          {cycleMonth && <Text type="secondary" style={{ fontSize: 14 }}>({cycleMonth})</Text>}
          {getStatusTag()}
        </span>
      }
      style={{ marginBottom: 24 }}
    >
      <Steps
        current={currentStep >= 0 ? currentStep : -1}
        status={cycleStatus === 'PAYMENT_COMPLETED' ? 'finish' : 'process'}
        items={steps.map((s, idx) => ({
          ...s,
          status:
            cycleStatus === 'PAYMENT_COMPLETED'
              ? 'finish'
              : idx < currentStep
              ? 'finish'
              : idx === currentStep
              ? 'process'
              : 'wait',
        }))}
      />
    </Card>
  );
};

export default WorkflowTimeline;
