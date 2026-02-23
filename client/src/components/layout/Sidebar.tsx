import {
    AuditOutlined,
    ClockCircleOutlined,
    DashboardOutlined,
    DollarOutlined,
    LineChartOutlined,
    MailOutlined,
    TeamOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Layout, Menu } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore, useAuthStore } from '../../stores';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const user = useAuthStore((s) => s.user);

  const isKOC = user?.role === 'KOC';

  // KOC users see only their revenue page
  const kocMenuItems: MenuProps['items'] = [
    {
      key: '/my-revenue',
      icon: <DollarOutlined />,
      label: t('kocPortal.title'),
    },
  ];

  // Admin/Accountant see the full menu
  const staffMenuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    },
    {
      key: '/koc',
      icon: <TeamOutlined />,
      label: t('menu.koc'),
    },
    {
      key: '/revenue',
      icon: <DollarOutlined />,
      label: t('menu.revenue'),
    },
    {
      key: '/stats',
      icon: <LineChartOutlined />,
      label: t('menu.stats'),
    },
    ...(user?.role === 'ADMIN'
      ? [
          {
            key: '/cron-settings',
            icon: <ClockCircleOutlined />,
            label: t('menu.cronSettings'),
          },
          {
            key: '/email-settings',
            icon: <MailOutlined />,
            label: t('menu.emailSettings'),
          },
          {
            key: '/audit',
            icon: <AuditOutlined />,
            label: t('menu.audit'),
          },
        ]
      : []),
  ];

  const menuItems = isKOC ? kocMenuItems : staffMenuItems;

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={sidebarCollapsed}
      breakpoint="lg"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        background: '#ED8F3A',
      }}
      theme="dark"
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <img src="/images/logo.jpg" alt="EBE Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        {!sidebarCollapsed && (
          <h2 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600 }}>
            EBE CMS
          </h2>
        )}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 0, background: '#ED8F3A' }}
      />
    </Sider>
  );
};

export default Sidebar;
