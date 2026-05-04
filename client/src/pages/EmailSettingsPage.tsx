import { GoogleOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';
import { Spin, Tabs, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmailConfigCard } from '../components/cron';
import GoogleLoginConfigCard from '../components/cron/GoogleLoginConfigCard';

const { Title } = Typography;

const EmailSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  return (
    <Spin spinning={isSendingEmail} tip={t('email.sendingEmails')} size="large" className="stats-page-spin">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Title level={3} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 8 }} />
            {t('menu.emailSettings')}
          </Title>
        </div>

        <Tabs
          defaultActiveKey="email"
          items={[
            {
              key: 'email',
              label: (
                <span>
                  <MailOutlined /> {t('menu.emailSettings', 'Email')}
                </span>
              ),
              children: <EmailConfigCard onSendingChange={setIsSendingEmail} />,
            },
            {
              key: 'google-login',
              label: (
                <span>
                  <GoogleOutlined style={{ color: '#4285f4' }} /> {t('googleLogin.tabLabel')}
                </span>
              ),
              children: <GoogleLoginConfigCard />,
            },
          ]}
        />
      </div>
    </Spin>
  );
};

export default EmailSettingsPage;
