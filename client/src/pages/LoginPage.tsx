import { GlobalOutlined, LockOutlined, MailOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Form, Input, Select, theme as antTheme } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useLogin } from '../hooks';
import { useAppStore, useAuthStore } from '../stores';
import type { LoginInput } from '../types';
import ForgotPasswordModal from '../components/login/ForgotPasswordModal';
import LoginBackground from '../components/login/LoginBackground';
import LoginBrandPanel from '../components/login/LoginBrandPanel';
import '../components/login/loginPage.css';

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const loginMutation = useLogin();

  const [visible, setVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [forgotOpen, setForgotOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleFinish = (values: LoginInput) => loginMutation.mutate(values);

  const handleLanguageChange = (value: 'vi' | 'en') => {
    i18n.changeLanguage(value);
    setLocale(value);
  };

  return (
    <div className="lp-root" ref={rootRef}>
      <LoginBackground mousePos={mousePos} />

      {/* Top controls */}
      <div className="lp-controls">
        <ConfigProvider theme={{ algorithm: antTheme.darkAlgorithm, token: { colorPrimary: '#ED8F3A', borderRadius: 8 } }}>
          <Select
            value={locale}
            onChange={handleLanguageChange}
            style={{ width: 130 }}
            suffixIcon={<GlobalOutlined />}
            options={[
              { value: 'vi', label: '🇻🇳 Tiếng Việt' },
              { value: 'en', label: '🇺🇸 English' },
            ]}
          />
        </ConfigProvider>
        <button onClick={() => setDarkMode(!darkMode)} className="lp-icon-btn">
          {darkMode ? <SunOutlined /> : <MoonOutlined />}
        </button>
      </div>

      {/* Card */}
      <div className={`lp-wrap ${visible ? 'lp-wrap--in' : ''}`}>
        <div className="lp-glow-border" />
        <div className="lp-card">
          <LoginBrandPanel />

          {/* Form panel */}
          <div className="lp-form-side">
            <p className={`lp-welcome ${visible ? 'lp-stagger-1' : ''}`}>{t('auth.login')}</p>

            <ConfigProvider
              theme={{
                algorithm: antTheme.darkAlgorithm,
                token: {
                  colorPrimary: '#ED8F3A',
                  colorBgContainer: 'rgba(255,255,255,0.04)',
                  colorBorder: 'rgba(237,143,58,0.25)',
                  colorText: '#f1f5f9',
                  colorTextPlaceholder: '#64748b',
                  borderRadius: 10,
                  fontSize: 15,
                },
              }}
            >
              <Form layout="vertical" onFinish={handleFinish} autoComplete="off" style={{ marginTop: 28 }}>
                <div className={`lp-field-wrap ${visible ? 'lp-stagger-2' : ''}`}>
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: t('auth.emailRequired') },
                      { type: 'email', message: t('auth.emailInvalid') },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined className="lp-input-icon" />}
                      placeholder={t('auth.emailPlaceholder')}
                      size="large"
                      className="lp-input"
                    />
                  </Form.Item>
                </div>

                <div className={`lp-field-wrap ${visible ? 'lp-stagger-3' : ''}`}>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: t('auth.passwordRequired') }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="lp-input-icon" />}
                      placeholder={t('auth.passwordPlaceholder')}
                      size="large"
                      className="lp-input"
                    />
                  </Form.Item>
                </div>

                <div className={`lp-field-wrap ${visible ? 'lp-stagger-4' : ''}`}>
                  <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      size="large"
                      loading={loginMutation.isPending}
                      className="lp-btn"
                      style={{
                        height: 50, fontWeight: 700, fontSize: 15,
                        letterSpacing: '0.3px', border: 'none',
                        background: 'linear-gradient(135deg, #ED8F3A 0%, #f5a962 100%)',
                        boxShadow: '0 4px 20px rgba(237,143,58,0.35)',
                      }}
                    >
                      {t('auth.login')}
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </ConfigProvider>

            <div className={`lp-footer ${visible ? 'lp-stagger-5' : ''}`}>
              <span onClick={() => setForgotOpen(true)} className="lp-link" style={{ cursor: 'pointer' }}>
                {t('auth.forgotPassword')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
};

export default LoginPage;
