import {
    AuditOutlined,
    ClockCircleOutlined,
    DashboardOutlined,
    DollarOutlined,
    LineChartOutlined,
    MailOutlined,
    TeamOutlined,
    YoutubeOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Drawer, Grid, Layout, Menu } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore, useAuthStore } from '../../stores';

const { Sider } = Layout;
const { useBreakpoint } = Grid;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const screens = useBreakpoint();

  const isKOC = user?.role === 'KOC';
  const isMobile = !screens.lg;

  const kocMenuItems: MenuProps['items'] = [
    {
      key: '/my-revenue',
      icon: <DollarOutlined />,
      label: t('kocPortal.title'),
    },
  ];

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

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) toggleSidebar();
  };

  const logo = (
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
      <img src="/images/logo.jpg" alt={t('app.logoAlt')} style={{ width: 40, height: 40, objectFit: 'contain' }} />
      {(!sidebarCollapsed || isMobile) && (
        <h2 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600 }}>
          {t('app.shortTitle')}
        </h2>
      )}
    </div>
  );

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ borderRight: 0, background: '#ED8F3A' }}
    />
  );

  // Mobile: use Drawer overlay
  if (isMobile) {
    return (
      <Drawer
        placement="left"
        open={!sidebarCollapsed}
        onClose={toggleSidebar}
        width={240}
        closable={false}
        styles={{ body: { padding: 0, background: '#ED8F3A' } }}
      >
        {logo}
        {menu}
      </Drawer>
    );
  }

  // Desktop: fixed Sider
  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={sidebarCollapsed}
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
      {logo}
      {menu}
    </Sider>
  );
};

export default Sidebar;
