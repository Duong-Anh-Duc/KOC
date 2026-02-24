import { GlobalOutlined, LockOutlined, MoonOutlined, SunOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Card, Dropdown, Form, Input, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useLogin } from '../hooks';
import { useAppStore, useAuthStore } from '../stores';
import type { LoginInput } from '../types';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const setLocale = useAppStore((s) => s.setLocale);
  const loginMutation = useLogin();
  const [isVisible, setIsVisible] = useState(false);

  React.useEffect(() => {
    setIsVisible(true);
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleFinish = (values: LoginInput) => {
    loginMutation.mutate(values);
  };

  const handleLanguageChange = (locale: 'vi' | 'en') => {
    i18n.changeLanguage(locale);
    setLocale(locale);
  };

  const languageMenu: MenuProps = {
    items: [
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
    ],
  };

  return (
    <div
      className="login-page-container"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: darkMode
          ? 'linear-gradient(135deg, #3d2817 0%, #1f1309 100%)'
          : 'linear-gradient(135deg, #ED8F3A 0%, #f5a962 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background animated circles */}
      <div className="login-bg-circle login-bg-circle-1" />
      <div className="login-bg-circle login-bg-circle-2" />
      <div className="login-bg-circle login-bg-circle-3" />

      {/* Settings buttons */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 10,
        }}
        className="login-settings-fade-in"
      >
        <Space size="middle">
          <Dropdown menu={languageMenu} trigger={['click']} placement="bottomRight">
            <Button
              shape="circle"
              size="large"
              icon={<GlobalOutlined />}
              style={{
                background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                backdropFilter: 'blur(10px)',
              }}
            />
          </Dropdown>
          <Button
            shape="circle"
            size="large"
            icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
            onClick={() => setDarkMode(!darkMode)}
            style={{
              background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              backdropFilter: 'blur(10px)',
            }}
          />
        </Space>
      </div>

      <Card
        className={`login-card ${isVisible ? 'login-card-visible' : ''}`}
        style={{
          width: 400,
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: darkMode
            ? '0 24px 64px rgba(0,0,0,0.6)'
            : '0 24px 64px rgba(0,0,0,0.25)',
          border: darkMode ? '1px solid rgba(255,255,255,0.1)' : 'none',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }} className="login-header-fade-in">
          <img 
            src="/images/logo.jpg" 
            alt={t('app.logoAlt')}
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 20px',
              display: 'block',
              objectFit: 'cover',
              objectPosition: 'left center',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              clipPath: 'polygon(0 0, 92% 0, 92% 100%, 0 100%)'
            }}
            className="login-logo-bounce"
          />
          <Title level={2} style={{ marginBottom: 8, fontSize: 26, fontWeight: 700 }}>
            {t('app.title')}
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>{t('auth.loginSubtitle')}</Text>
        </div>

        <Form layout="vertical" onFinish={handleFinish} size="large" className="login-form-slide-up">
          <Form.Item
            name="email"
            label={t('auth.email')}
            rules={[
              { required: true, message: t('auth.emailRequired') },
              { type: 'email', message: t('auth.emailInvalid') },
            ]}
            style={{ marginBottom: 16 }}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
              placeholder={t('auth.emailPlaceholder')}
              style={{ height: 44, borderRadius: 8, fontSize: 14 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
            style={{ marginBottom: 16 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
              placeholder={t('auth.passwordPlaceholder')}
              style={{ height: 44, borderRadius: 8, fontSize: 14 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              block
              style={{
                height: 48,
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #ED8F3A 0%, #f5a962 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(237, 143, 58, 0.4)',
              }}
              className="login-button"
            >
              {t('auth.login')}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('auth.demoAccount')}: admin@koc-scraper.com / Admin@Koc2026!
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
