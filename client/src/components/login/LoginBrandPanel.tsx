import React from 'react';
import { useTranslation } from 'react-i18next';

const LoginBrandPanel: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="lp-brand">
      <div className="lp-logo-wrap">
        <img src="/images/logo.jpg" alt="EBE CMS" className="lp-logo" />
        <div className="lp-ring" />
        <div className="lp-ring lp-ring-2" />
      </div>
      <h1 className="lp-brand-name">EBE<span>CMS</span></h1>
      <p className="lp-brand-sub">{t('auth.loginSubtitle')}</p>
      <div className="lp-dots">
        <span className="lp-dot" style={{ background: '#ED8F3A' }} />
        <span className="lp-dot" style={{ background: '#f5a962' }} />
        <span className="lp-dot" style={{ background: '#00BCD4' }} />
      </div>
    </div>
  );
};

export default LoginBrandPanel;
