import { useQuery } from '@tanstack/react-query';
import { Col, Form, Row } from 'antd';
import React, { useEffect, useState } from 'react';
import { emailApi } from '../../api';
import BulkEmailSendSection from './BulkEmailSendSection';
import EmailSendResultModal from './EmailSendResultModal';
import SmtpConfigForm from './SmtpConfigForm';

interface EmailConfigCardProps {
  onSendingChange?: (isSending: boolean) => void;
}

const EmailConfigCard: React.FC<EmailConfigCardProps> = ({ onSendingChange }) => {
  const [sendResultModal, setSendResultModal] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);
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

  const handleSendComplete = (data: any) => {
    setSendResults(data);
    setSendResultModal(true);
  };

  return (
    <>
      <Row gutter={16}>
        {/* SMTP Configuration */}
        <Col xs={24} lg={12}>
          <SmtpConfigForm
            smtpForm={smtpForm}
            emailConfig={emailConfig}
            configLoading={configLoading}
          />
        </Col>

        {/* Send Revenue Emails */}
        <Col xs={24} lg={12}>
          <BulkEmailSendSection
            onSendingChange={onSendingChange}
            onSendComplete={handleSendComplete}
          />
        </Col>
      </Row>

      {/* Send Results Modal */}
      <EmailSendResultModal
        open={sendResultModal}
        onClose={() => setSendResultModal(false)}
        sendResults={sendResults}
      />
    </>
  );
};

export default EmailConfigCard;
