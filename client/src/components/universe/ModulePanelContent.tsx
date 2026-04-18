import React from 'react';
import type { AuditLog, DashboardOverview } from '../../types';
import {
  AuditPanel,
  CronPanel,
  DashboardPanel,
  EmailSettingsPanel,
  KocPanel,
  PermissionsPanel,
  RevenuePanel,
  SendEmailPanel,
  StatsPanel,
  UsersPanel,
} from './StaffPanelBlocks';
import { ClockPanel, GrowthPanel, MyRevenuePanel } from './KocPanelBlocks';

interface Props {
  moduleId: string;
  overview: DashboardOverview | undefined;
  auditLogs: AuditLog[] | undefined;
  onOpen: () => void;
}

const ModulePanelContent: React.FC<Props> = ({ moduleId, overview, auditLogs, onOpen }) => {
  const common = { overview, auditLogs, onOpen };
  switch (moduleId) {
    case 'dashboard':        return <DashboardPanel {...common} />;
    case 'koc':              return <KocPanel {...common} />;
    case 'revenue':          return <RevenuePanel {...common} />;
    case 'stats':            return <StatsPanel {...common} />;
    case 'send-email':       return <SendEmailPanel {...common} />;
    case 'audit':            return <AuditPanel {...common} />;
    case 'users':            return <UsersPanel {...common} />;
    case 'cron-settings':    return <CronPanel {...common} />;
    case 'email-settings':   return <EmailSettingsPanel {...common} />;
    case 'permissions':      return <PermissionsPanel {...common} />;
    case 'my-revenue':       return <MyRevenuePanel {...common} />;
    case 'clock':            return <ClockPanel {...common} />;
    case 'growth':           return <GrowthPanel {...common} />;
    default:                 return null;
  }
};

export default ModulePanelContent;
