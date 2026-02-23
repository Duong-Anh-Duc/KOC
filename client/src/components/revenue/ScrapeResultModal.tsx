import { Button, Card, Col, Modal, Row, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

interface ScrapeResultModalProps {
  open: boolean;
  data: any;
  onClose: () => void;
}

const ScrapeResultModal: React.FC<ScrapeResultModalProps> = ({ open, data, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('cycle.scrapeResult')}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      width={700}
    >
      {data && (
        <div>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small">
                <Text type="secondary">{t('common.total')} KOCs</Text>
                <Title level={4} style={{ margin: 0 }}>{data.summary?.totalKOCs || 0}</Title>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Text type="secondary">{t('cycle.scraped')}</Text>
                <Title level={4} style={{ margin: 0, color: '#1677ff' }}>{data.summary?.scraped || 0}</Title>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Text type="secondary">{t('cycle.recordsSkipped')}</Text>
                <Title level={4} style={{ margin: 0, color: '#faad14' }}>{data.summary?.recordsSkipped || 0}</Title>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Text type="secondary">{t('cycle.recordsCreated')}</Text>
                <Title level={4} style={{ margin: 0, color: '#52c41a' }}>{data.summary?.recordsCreated || 0}</Title>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Text type="secondary">{t('cycle.recordsUpdated')}</Text>
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>{data.summary?.recordsUpdated || 0}</Title>
              </Card>
            </Col>
          </Row>

          {data.created?.length > 0 && (
            <Card size="small" title={`✅ ${t('cycle.recordsCreated')} (${data.created.length})`} style={{ marginBottom: 12 }}>
              {data.created.map((item: any, i: number) => (
                <Tag key={i} color="green" style={{ marginBottom: 4 }}>
                  {item.koc}: ${item.revenue?.toFixed(2)}
                </Tag>
              ))}
            </Card>
          )}

          {data.updated?.length > 0 && (
            <Card size="small" title={`🔄 ${t('cycle.recordsUpdated')} (${data.updated.length})`} style={{ marginBottom: 12 }}>
              {data.updated.map((item: any, i: number) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                  {item.koc}: ${item.revenue?.toFixed(2)}
                </Tag>
              ))}
            </Card>
          )}

          {data.skipped?.length > 0 && (
            <Card size="small" title={`⏭️ ${t('cycle.recordsSkipped')} (${data.skipped.length})`} style={{ marginBottom: 12 }}>
              {data.skipped.map((item: any, i: number) => (
                <Tag key={i} color="orange" style={{ marginBottom: 4 }}>
                  {item.koc}: {item.reason}
                </Tag>
              ))}
            </Card>
          )}

          {data.scrapeErrors?.length > 0 && (
            <Card size="small" title={`❌ ${t('common.errors')} (${data.scrapeErrors.length})`}>
              {data.scrapeErrors.map((item: any, i: number) => (
                <Tag key={i} color="red" style={{ marginBottom: 4 }}>
                  {item.channelId}: {item.error}
                </Tag>
              ))}
            </Card>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ScrapeResultModal;
