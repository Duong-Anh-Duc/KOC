import {
  BulbOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Button, Dropdown, Layout, Space, Tag } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLogout } from '../../hooks';
import { useAppStore, useAuthStore } from '../../stores';

const { Header: AntHeader } = Layout;

const Navbar: React.FC = () => {
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
