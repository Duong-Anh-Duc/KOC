import { Input, Modal, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CookieImportModalProps {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onImport: (cookies: Array<Record<string, unknown>>) => void;
}

const CookieImportModal: React.FC<CookieImportModalProps> = ({ open, loading, onCancel, onImport }) => {
  const { t } = useTranslation();
  const [cookieText, setCookieText] = useState('');

  const handleOk = () => {
    try {
      const parsed = JSON.parse(cookieText.trim());
      const cookies = Array.isArray(parsed) ? parsed : [parsed];
      if (cookies.length === 0) return;
      onImport(cookies);
    } catch {
      // invalid JSON handled by parent
    }
  };

  const handleCancel = () => {
    setCookieText('');
    onCancel();
  };

  return (
    <Modal
      title={t('ytScraper.importCookies')}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText={t('ytScraper.importCookiesSubmit')}
      okButtonProps={{ loading, disabled: !cookieText.trim() }}
      cancelText={t('common.cancel')}
      width={640}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <strong>{t('ytScraper.importCookiesDesc')}</strong>
        </Typography.Paragraph>
        <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>{t('ytScraper.importCookiesStep1')}</li>
          <li>{t('ytScraper.importCookiesStep2')}</li>
          <li>{t('ytScraper.importCookiesStep3')}</li>
          <li>{t('ytScraper.importCookiesStep4')}</li>
        </ol>
      </div>
      <Input.TextArea
        rows={10}
        placeholder='[{"name": "SID", "value": "...", "domain": ".youtube.com", ...}]'
        value={cookieText}
        onChange={(e) => setCookieText(e.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
    </Modal>
  );
};

export default CookieImportModal;
