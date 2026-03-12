import { MailOutlined } from '@ant-design/icons';
import { Spin, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmailConfigCard } from '../components/cron';

const { Title } = Typography;

const EmailSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  return (
    <Spin spinning={isSendingEmail} tip={t('email.sendingEmails')} size="large" className="stats-page-spin">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Title level={3} style={{ margin: 0 }}>
            <MailOutlined style={{ marginRight: 8 }} />
            {t('menu.emailSettings')}
          </Title>
        </div>

        <EmailConfigCard onSendingChange={setIsSendingEmail} />
      </div>
    </Spin>
  );
};

export default EmailSettingsPage;
