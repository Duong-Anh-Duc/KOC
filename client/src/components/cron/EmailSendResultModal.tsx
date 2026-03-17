import {
  Button,
  Card,
  Col,
  Modal,
  Row,
  Table,
  Typography
} from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface EmailSendResultModalProps {
  open: boolean;
  onClose: () => void;
  sendResults: any;
}

const EmailSendResultModal: React.FC<EmailSendResultModalProps> = ({ open, onClose, sendResults }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('email.sendResults')}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('common.close')}
        </Button>,
      ]}
      width={700}
    >
      {sendResults && (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#52c41a' }}>
                <Text type="secondary">{t('email.sent')}</Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                  {sendResults.sent?.length || 0}
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#ff4d4f' }}>
                <Text type="secondary">{t('email.failed')}</Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>
                  {sendResults.failed?.length || 0}
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#faad14' }}>
                <Text type="secondary">{t('email.skipped')}</Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>
                  {sendResults.skipped?.length || 0}
                </div>
              </Card>
            </Col>
          </Row>

          {sendResults.sent?.length > 0 && (
            <>
              <Text strong style={{ color: '#52c41a' }}>{t('email.sentList')}</Text>
              <Table
                dataSource={sendResults.sent}
                rowKey="kocId"
                size="small"
                pagination={false}
                style={{ marginTop: 8, marginBottom: 16 }}
                columns={[
                  { title: t('email.kocName'), dataIndex: 'kocName' },
                  { title: t('email.emailAddress'), dataIndex: 'email' },
                ]}
              />
            </>
          )}

          {sendResults.failed?.length > 0 && (
            <>
              <Text strong style={{ color: '#ff4d4f' }}>{t('email.failedList')}</Text>
              <Table
                dataSource={sendResults.failed}
                rowKey="kocId"
                size="small"
                pagination={false}
                style={{ marginTop: 8, marginBottom: 16 }}
                columns={[
                  { title: t('email.kocName'), dataIndex: 'kocName' },
                  { title: t('email.emailAddress'), dataIndex: 'email' },
                  { title: t('common.errors'), dataIndex: 'error' },
                ]}
              />
            </>
          )}

          {sendResults.skipped?.length > 0 && (
            <>
              <Text strong style={{ color: '#faad14' }}>{t('email.skippedList')}</Text>
              <Table
                dataSource={sendResults.skipped}
                rowKey="kocId"
                size="small"
                pagination={false}
                style={{ marginTop: 8 }}
                columns={[
                  { title: t('email.kocName'), dataIndex: 'kocName' },
                  { title: t('email.reason'), dataIndex: 'reason', render: (val: string) => t(val, val) },
                ]}
              />
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export default EmailSendResultModal;
