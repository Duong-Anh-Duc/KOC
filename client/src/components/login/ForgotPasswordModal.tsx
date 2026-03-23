import { LockOutlined, MailOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Form, Input, message, Modal, Steps, theme as antTheme } from 'antd';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth.api';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [step, setStep]       = useState(0);
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [emailForm] = Form.useForm();
  const [otpForm]   = Form.useForm();
  const [resetForm] = Form.useForm();

  const startCountdown = () => {
    setCountdown(300);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleClose = () => {
    setStep(0); setEmail(''); setOtp(''); setLoading(false);
    stopCountdown();
    emailForm.resetFields(); otpForm.resetFields(); resetForm.resetFields();
    onClose();
  };

  const handleSendOtp = async (values: { email: string }) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(values.email);
      setEmail(values.email);
      setStep(1);
      startCountdown();
      message.success(t('auth.otpSent'));
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      startCountdown();
      otpForm.resetFields();
      message.success(t('auth.otpSent'));
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (values: { otp: string }) => {
    setLoading(true);
    try {
      await authApi.verifyOtp({ email, otp: values.otp });
      setOtp(values.otp);
      setStep(2);
      stopCountdown();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (values: { newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, otp, newPassword: values.newPassword });
      message.success(t('auth.resetSuccess'));
      handleClose();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    } finally { setLoading(false); }
  };

  const primaryBtnStyle = { height: 48, fontWeight: 700, border: 'none', background: 'linear-gradient(135deg, #ED8F3A 0%, #f5a962 100%)' } as const;

  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.darkAlgorithm,
        token: {
          colorPrimary: '#ED8F3A',
          colorBgElevated: 'rgba(10,16,30,0.97)',
          colorBgContainer: 'rgba(255,255,255,0.04)',
          colorBorder: 'rgba(237,143,58,0.25)',
          colorText: '#f1f5f9',
          colorTextSecondary: '#94a3b8',
          colorTextPlaceholder: '#64748b',
          borderRadius: 10,
          fontSize: 14,
        },
      }}
    >
      <Modal
        open={open}
        onCancel={handleClose}
        footer={null}
        title={
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
            {t('auth.resetPassword')}
          </span>
        }
        destroyOnHidden
        width={460}
        className="lp-modal"
        styles={{
          mask: { backdropFilter: 'blur(8px)', background: 'rgba(7,12,21,0.7)' },
          content: {
            background: 'rgba(10,16,30,0.97)',
            border: '1px solid rgba(237,143,58,0.18)',
            borderRadius: 20,
            boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(237,143,58,0.05)',
          },
          header: { background: 'transparent', borderBottom: '1px solid rgba(237,143,58,0.12)', paddingBottom: 16 },
          body: { padding: '24px 0 0' },
        }}
      >
        <Steps
          current={step}
          size="small"
          className="lp-modal-steps"
          style={{ marginBottom: 28 }}
          items={[
            { title: <span style={{ fontSize: 12 }}>{t('auth.email')}</span> },
            { title: <span style={{ fontSize: 12 }}>{t('auth.enterOtp')}</span> },
            { title: <span style={{ fontSize: 12 }}>{t('auth.newPassword')}</span> },
          ]}
        />

        <div className="lp-step-viewport">
          <div className="lp-steps-track" style={{ transform: `translateX(calc(-${step * 100}% / 3))` }}>

            {/* Panel 0: Email */}
            <div className={`lp-step-panel ${step === 0 ? 'lp-panel-active' : ''}`}>
              <Form form={emailForm} layout="vertical" onFinish={handleSendOtp}>
                <div className="lp-modal-field lp-mstagger-1">
                  <Form.Item
                    name="email"
                    label={<span className="lp-modal-label">{t('auth.email')}</span>}
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
                <div className="lp-modal-field lp-mstagger-2">
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large" className="lp-btn" style={primaryBtnStyle}>
                      {t('auth.sendOtp')}
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </div>

            {/* Panel 1: OTP */}
            <div className={`lp-step-panel ${step === 1 ? 'lp-panel-active' : ''}`}>
              <Form form={otpForm} layout="vertical" onFinish={handleVerifyOtp}>
                <div className="lp-modal-field lp-mstagger-1">
                  <div className="lp-info-box">
                    <span style={{ color: '#4ade80' }}>✓ </span>
                    <span style={{ color: '#94a3b8' }}>{t('auth.otpSent')} </span>
                    <strong style={{ color: '#ED8F3A' }}>{email}</strong>
                  </div>
                </div>
                <div className="lp-modal-field lp-mstagger-2">
                  <Form.Item
                    name="otp"
                    label={<span className="lp-modal-label">{t('auth.enterOtp')}</span>}
                    rules={[
                      { required: true, message: t('auth.enterOtp') },
                      { len: 6, message: t('auth.otpLength') || 'OTP phải có 6 chữ số' },
                    ]}
                  >
                    <Input placeholder="• • • • • •" maxLength={6} size="large" className="lp-input lp-otp-input" />
                  </Form.Item>
                </div>
                <div className="lp-modal-field lp-mstagger-3">
                  <div className="lp-countdown-row">
                    {countdown > 0 ? (
                      <span style={{ color: '#64748b', fontSize: 13 }}>
                        {t('auth.otpExpireIn') || 'Mã hết hạn sau'}{' '}
                        <span style={{ color: countdown <= 60 ? '#f87171' : '#ED8F3A', fontWeight: 700 }}>
                          {formatCountdown(countdown)}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: '#f87171', fontSize: 13 }}>{t('auth.otpExpired')}</span>
                    )}
                    <button type="button" disabled={countdown > 0 || loading} onClick={handleResendOtp} className="lp-resend-btn">
                      <ReloadOutlined style={{ marginRight: 4, fontSize: 11 }} />
                      {t('auth.resendOtp') || 'Gửi lại OTP'}
                    </button>
                  </div>
                </div>
                <div className="lp-modal-field lp-mstagger-4">
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large" className="lp-btn" style={primaryBtnStyle}>
                      {t('auth.verifyOtp') || 'Xác minh OTP'}
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </div>

            {/* Panel 2: New password */}
            <div className={`lp-step-panel ${step === 2 ? 'lp-panel-active' : ''}`}>
              <Form form={resetForm} layout="vertical" onFinish={handleResetPassword}>
                <div className="lp-modal-field lp-mstagger-1">
                  <div className="lp-info-box lp-info-box--success">
                    <span style={{ color: '#4ade80', marginRight: 6 }}>✓</span>
                    <span style={{ color: '#94a3b8' }}>{t('auth.otpVerifiedMsg') || 'OTP đã xác minh. Vui lòng nhập mật khẩu mới.'}</span>
                  </div>
                </div>
                <div className="lp-modal-field lp-mstagger-2">
                  <Form.Item
                    name="newPassword"
                    label={<span className="lp-modal-label">{t('auth.newPassword')}</span>}
                    rules={[
                      { required: true, message: t('auth.newPassword') },
                      { min: 6, message: t('profile.passwordMinLength') },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined className="lp-input-icon" />} size="large" className="lp-input" />
                  </Form.Item>
                </div>
                <div className="lp-modal-field lp-mstagger-3">
                  <Form.Item
                    name="confirmPassword"
                    label={<span className="lp-modal-label">{t('auth.confirmNewPassword')}</span>}
                    rules={[
                      { required: true, message: t('auth.confirmNewPassword') },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                          return Promise.reject(new Error(t('auth.passwordMismatch')));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined className="lp-input-icon" />} size="large" className="lp-input" />
                  </Form.Item>
                </div>
                <div className="lp-modal-field lp-mstagger-4">
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large" className="lp-btn" style={primaryBtnStyle}>
                      {t('auth.resetPassword')}
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </div>

          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default ForgotPasswordModal;
