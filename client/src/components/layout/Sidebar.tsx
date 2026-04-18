import {
    AuditOutlined,
    ClockCircleOutlined,
    DashboardOutlined,
    DollarOutlined,
    GlobalOutlined,
    LineChartOutlined,
    MailOutlined,
    SafetyOutlined,
    SendOutlined,
    ShareAltOutlined,
    TeamOutlined,
    UserSwitchOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Drawer, Grid, Layout, Menu } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
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
  const { hasPermission } = usePermissions();

  const isKOC = user?.role === 'KOC';
  const isAdmin = user?.role === 'ADMIN';
  const isMobile = !screens.lg;

  const kocMenuItems: MenuProps['items'] = [
    {
      key: '/my-revenue',
      icon: <DollarOutlined />,
      label: t('kocPortal.title'),
    },
    {
      key: '/universe',
      icon: <GlobalOutlined />,
      label: t('menu.universe'),
    },
  ];

  // Manager menu: flat list filtered by permissions (no groups to keep it simple)
  const managerMenuItems: MenuProps['items'] = [
    hasPermission('view_info') || hasPermission('view_revenue') ? {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    } : null,
    hasPermission('view_info') || hasPermission('edit_info') ? {
      key: '/koc',
      icon: <TeamOutlined />,
      label: t('menu.koc'),
    } : null,
    hasPermission('view_revenue') || hasPermission('edit_revenue') ? {
      key: '/revenue',
      icon: <DollarOutlined />,
      label: t('menu.revenue'),
    } : null,
    hasPermission('view_stats') ? {
      key: '/stats',
      icon: <LineChartOutlined />,
      label: t('menu.stats'),
    } : null,
    hasPermission('send_email') ? {
      key: '/send-revenue-email',
      icon: <SendOutlined />,
      label: t('menu.sendRevenueEmail'),
    } : null,
    {
      key: '/universe',
      icon: <GlobalOutlined />,
      label: t('menu.universe'),
    },
    null,
  ].filter(Boolean) as NonNullable<MenuProps['items']>;

  // Admin menu: grouped by function
  const adminMenuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    },
    {
      key: '/universe',
      icon: <GlobalOutlined />,
      label: t('menu.universe'),
    },
    {
      type: 'group',
      label: t('menu.groupManagement'),
      children: [
        { key: '/koc',     icon: <TeamOutlined />,      label: t('menu.koc') },
        { key: '/revenue', icon: <DollarOutlined />,    label: t('menu.revenue') },
        { key: '/stats',   icon: <LineChartOutlined />, label: t('menu.stats') },
      ],
    },
    {
      type: 'group',
      label: t('menu.groupChannel'),
      children: [
        { key: '/cron-settings',       icon: <ShareAltOutlined />,     label: t('menu.cronSettings') },
        { key: '/email-settings',      icon: <MailOutlined />,         label: t('menu.emailSettings') },
        { key: '/send-revenue-email',  icon: <SendOutlined />,         label: t('menu.sendRevenueEmail') },
      ],
    },
    {
      type: 'group',
      label: t('menu.groupSystem'),
      children: [
        { key: '/users',       icon: <UserSwitchOutlined />, label: t('menu.users') },
        { key: '/permissions', icon: <SafetyOutlined />,     label: t('menu.permissions') },
        { key: '/audit',       icon: <AuditOutlined />,      label: t('menu.audit') },
      ],
    },
  ];

  const staffMenuItems = isAdmin ? adminMenuItems : managerMenuItems;
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
    <>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0, background: '#ED8F3A' }}
      />
      <style>{`
        .ant-menu-item-group-title {
          color: rgba(255,255,255,0.55) !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: 0.08em !important;
          padding-top: 16px !important;
          padding-left: 24px !important;
          text-transform: uppercase;
        }
        .ant-layout-sider-collapsed .ant-menu-item-group-title {
          display: none !important;
        }
      `}</style>
    </>
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
