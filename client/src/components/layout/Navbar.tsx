import {
  BulbOutlined,
  EditOutlined,
  GlobalOutlined,
  GoogleOutlined,
  LoadingOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Grid, Layout, Space } from 'antd';
import { AppAvatar, AppTag, AppTooltip, NativeSelect } from '../common';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGoogleLoginStatus, useLogout } from '../../hooks';
import { useAppStore, useAuthStore } from '../../stores';
import ChangePasswordModal from './ChangePasswordModal';
import ProfileModal from './ProfileModal';

const { useBreakpoint } = Grid;

const { Header: AntHeader } = Layout;

interface NavbarProps {
  gemLogin?: { isRunning: boolean; isStarting: boolean; activeProfileId?: string | null };
}

const Navbar: React.FC<NavbarProps> = ({ gemLogin }) => {
  const { t, i18n } = useTranslation();
  const { sidebarCollapsed, toggleSidebar, locale, setLocale, darkMode, toggleDarkMode } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const handleLogout = useLogout();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();
  const googleStatus = useGoogleLoginStatus();

  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLanguageChange = (lang: 'vi' | 'en') => {
    setLocale(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <>
      <AntHeader
        style={{
          padding: isMobile ? '0 12px' : '0 24px',
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

        <Space size={isMobile ? 'small' : 'middle'}>
          {gemLogin && !isMobile && (
            <AppTooltip title={gemLogin.isRunning ? `GemLogin running${gemLogin.activeProfileId ? ` — Profile ${gemLogin.activeProfileId}` : ''}` : 'GemLogin starting...'}>
              <AppTag
                icon={gemLogin.isRunning ? <GlobalOutlined style={{ marginRight: 4 }} /> : <LoadingOutlined style={{ marginRight: 4 }} />}
                color={gemLogin.isRunning ? 'success' : 'processing'}
                style={{ cursor: 'default', userSelect: 'none' }}
              >
                {gemLogin.isRunning ? 'GemLogin' : t('common.loading')}
              </AppTag>
            </AppTooltip>
          )}

          {gemLogin?.isRunning && !isMobile && (
            <AppTooltip
              title={
                googleStatus.loggedIn
                  ? t('googleLogin.navTagTooltipLogged', {
                      time: googleStatus.verifiedAt ? new Date(googleStatus.verifiedAt).toLocaleString() : '?',
                    })
                  : `${t('googleLogin.navTagTooltipNeedLoginPrefix')}${googleStatus.message ? ` — ${googleStatus.message}` : ''}${t('googleLogin.navTagTooltipNeedLoginSuffix')}`
              }
            >
              <AppTag
                icon={googleStatus.loggedIn ? <GoogleOutlined style={{ marginRight: 4 }} /> : <WarningOutlined style={{ marginRight: 4 }} />}
                color={googleStatus.loggedIn ? 'success' : 'warning'}
                style={{ cursor: googleStatus.loggedIn ? 'default' : 'pointer', userSelect: 'none' }}
                onClick={() => { if (!googleStatus.loggedIn) navigate('/email-settings'); }}
              >
                {googleStatus.loggedIn ? t('googleLogin.navTagLogged') : t('googleLogin.navTagNeedLogin')}
              </AppTag>
            </AppTooltip>
          )}

          <Button
            type="text"
            icon={<BulbOutlined />}
            onClick={toggleDarkMode}
            style={{ color: '#fff' }}
            title={darkMode ? t('common.lightMode') : t('common.darkMode')}
          />

          {!isMobile && (
            <>
              {/* AntD-original:
              <Dropdown menu={{ items: languageItems, selectedKeys: [locale] }} placement="bottomRight">
                <Button type="text" icon={<GlobalOutlined />} style={{ color: '#fff' }}>
                  {locale === 'vi' ? 'VI' : 'EN'}
                </Button>
              </Dropdown>
              */}
              <NativeSelect
                value={locale}
                onChange={(v) => handleLanguageChange((v || 'vi') as 'vi' | 'en')}
                style={{ width: 86, background: 'rgba(255,255,255,0.16)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
                options={[
                  { value: 'vi', label: 'VI' },
                  { value: 'en', label: 'EN' },
                ]}
              />
            </>
          )}

          <div style={{ position: 'relative' }}>
            {/* AntD-original: <Dropdown menu={{ items: userMenuItems }} placement="bottomRight"> */}
            <Space style={{ cursor: 'pointer' }} onClick={() => setUserMenuOpen((open) => !open)}>
              {/* AntD-original: <Avatar src={...} icon={...} /> */}
              <AppAvatar
                src={user?.avatar_url}
                icon={!user?.avatar_url ? <UserOutlined /> : undefined}
                style={{ backgroundColor: user?.avatar_url ? undefined : '#fff', color: user?.avatar_url ? undefined : '#ED8F3A' }}
              />
              {!isMobile && <span style={{ fontWeight: 500, color: '#fff' }}>{user?.full_name}</span>}
              <AppTag color={user?.role === 'ADMIN' ? 'red' : 'blue'}>{user?.role}</AppTag>
            </Space>
            {userMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  minWidth: 220,
                  padding: 8,
                  background: darkMode ? '#1f1f1f' : '#fff',
                  border: `1px solid ${darkMode ? '#424242' : '#eee'}`,
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
                  zIndex: 120,
                }}
              >
                <div style={{ padding: '8px 10px', color: darkMode ? '#f5f5f5' : '#333', fontWeight: 600 }}>
                  <UserOutlined style={{ marginRight: 8 }} />
                  {user?.full_name || user?.email}
                </div>
                <div style={{ height: 1, background: darkMode ? '#333' : '#eee', margin: '4px 0' }} />
                <button className="native-menu-item" type="button" onClick={() => { setUserMenuOpen(false); setProfileOpen(true); }}>
                  <EditOutlined /> {t('profile.editProfile')}
                </button>
                <button className="native-menu-item" type="button" onClick={() => { setUserMenuOpen(false); setPasswordOpen(true); }}>
                  <LockOutlined /> {t('profile.changePassword')}
                </button>
                <div style={{ height: 1, background: darkMode ? '#333' : '#eee', margin: '4px 0' }} />
                <button className="native-menu-item native-menu-item-danger" type="button" onClick={handleLogout}>
                  <LogoutOutlined /> {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        </Space>
      </AntHeader>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
};

export default Navbar;
