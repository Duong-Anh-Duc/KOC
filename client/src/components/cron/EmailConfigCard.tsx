import { useQuery } from '@tanstack/react-query';
import { Form } from 'antd';
import React, { useEffect } from 'react';
import { emailApi } from '../../api';
import SmtpConfigForm from './SmtpConfigForm';

interface EmailConfigCardProps {
  onSendingChange?: (isSending: boolean) => void;
}

const EmailConfigCard: React.FC<EmailConfigCardProps> = () => {
  const [smtpForm] = Form.useForm();

  // Fetch email config
  const { data: configRes, isLoading: configLoading } = useQuery({
    queryKey: ['email-config'],
    queryFn: async () => {
      const res = await emailApi.getConfig();
      return res.data;
    },
  });

  const emailConfig = configRes?.data;

  // Sync config into form when loaded
  useEffect(() => {
    if (emailConfig) {
      smtpForm.setFieldsValue({
        smtpHost: emailConfig.smtpHost || '',
        smtpPort: emailConfig.smtpPort || 587,
        smtpSecure: emailConfig.smtpSecure ?? false,
        smtpUser: emailConfig.smtpUser || '',
        smtpPass: emailConfig.smtpPass || '',
        fromName: emailConfig.fromName || '',
        fromEmail: emailConfig.fromEmail || '',
      });
    }
  }, [emailConfig, smtpForm]);

  return (
    <SmtpConfigForm
      smtpForm={smtpForm}
      emailConfig={emailConfig}
      configLoading={configLoading}
    />
  );
};

export default EmailConfigCard;
