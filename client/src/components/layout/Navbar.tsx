import {
  BulbOutlined,
  GlobalOutlined,
  LoadingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Button, Dropdown, Layout, Space, Tag, Tooltip } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLogout } from '../../hooks';
import { useAppStore, useAuthStore } from '../../stores';

const { Header: AntHeader } = Layout;

interface NavbarProps {
  gemLogin?: { isRunning: boolean; isStarting: boolean; activeProfileId?: string | null };
}

const Navbar: React.FC<NavbarProps> = ({ gemLogin }) => {
  const { t, i18n } = useTranslation();
  const { sidebarCollapsed, toggleSidebar, locale, setLocale, darkMode, toggleDarkMode } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const handleLogout = useLogout();

  const handleLanguageChange = (lang: 'vi' | 'en') => {
    setLocale(lang);
    i18n.changeLanguage(lang);
  };

  const languageItems: MenuProps['items'] = [
    {
      key: 'vi',
      label: t('language.viLabel'),
      onClick: () => handleLanguageChange('vi'),
    },
    {
      key: 'en',
      label: t('language.enLabel'),
      onClick: () => handleLanguageChange('en'),
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: user?.full_name || user?.email,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('auth.logout'),
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <AntHeader
      style={{
        padding: '0 24px',
        background: '#ED8F3A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        position: 'sticky',
        top: 0,
        zIndex: 99,
      }}
    >
      <Button
        type="text"
        icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleSidebar}
        style={{ fontSize: 16, color: '#fff' }}
      />

      <Space size="middle">
        {/* GemLogin status badge — chỉ hiện cho staff */}
        {gemLogin && (
          <Tooltip title={gemLogin.isRunning ? `GemLogin đang chạy${gemLogin.activeProfileId ? ` — Profile ${gemLogin.activeProfileId}` : ''}` : 'GemLogin đang khởi động...'}>
            <Tag
              icon={gemLogin.isRunning ? <GlobalOutlined style={{ marginRight: 4 }} /> : <LoadingOutlined style={{ marginRight: 4 }} />}
              color={gemLogin.isRunning ? 'success' : 'processing'}
              style={{ cursor: 'default', userSelect: 'none' }}
            >
              {gemLogin.isRunning ? 'GemLogin' : 'Đang khởi động...'}
            </Tag>
          </Tooltip>
        )}

        <Button
          type="text"
          icon={<BulbOutlined />}
          onClick={toggleDarkMode}
          style={{ color: '#fff' }}
          title={darkMode ? t('common.lightMode') : t('common.darkMode')}
        />

        <Dropdown menu={{ items: languageItems, selectedKeys: [locale] }} placement="bottomRight">
          <Button type="text" icon={<GlobalOutlined />} style={{ color: '#fff' }}>
            {locale === 'vi' ? 'VI' : 'EN'}
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#fff', color: '#ED8F3A' }} />
            <span style={{ fontWeight: 500, color: '#fff' }}>{user?.full_name}</span>
            <Tag color={user?.role === 'ADMIN' ? 'red' : 'blue'}>{user?.role}</Tag>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Navbar;
