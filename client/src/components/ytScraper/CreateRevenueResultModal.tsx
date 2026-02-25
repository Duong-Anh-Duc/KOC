import { DollarOutlined } from '@ant-design/icons';
import { Button, Card, Col, Modal, Row, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatUSD } from '../../utils';

const { Title, Text } = Typography;

interface CreateRevenueResultModalProps {
  open: boolean;
  data: any;
  onClose: () => void;
}

const CreateRevenueResultModal: React.FC<CreateRevenueResultModalProps> = ({ open, data, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={
        <span>
          <DollarOutlined style={{ marginRight: 8 }} />
          {t('ytScraper.createRevenueResult')}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      width={600}
    >
      {data && (
        <div>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small">
                <Text type="secondary">{t('common.kocs')}</Text>
                <Title level={4} style={{ margin: 0 }}>
                  {data.summary?.totalKOCs || 0}
                </Title>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Text type="secondary">{t('ytScraper.recordsCreated')}</Text>
                <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                  {data.summary?.recordsCreated || 0}
                </Title>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Text type="secondary">{t('ytScraper.recordsSkipped')}</Text>
                <Title level={4} style={{ margin: 0, color: '#faad14' }}>
                  {data.summary?.recordsSkipped || 0}
                </Title>
              </Card>
            </Col>
          </Row>

          {data.created?.length > 0 && (
            <Card size="small" title={`${t('ytScraper.recordsCreated')} (${data.created.length})`} style={{ marginBottom: 12 }}>
              {data.created.map((item: any, i: number) => (
                <Tag key={i} color="green" style={{ marginBottom: 4 }}>
                  {item.koc}: {item.revenue != null ? formatUSD(item.revenue) : '-'}
                </Tag>
              ))}
            </Card>
          )}

          {data.skipped?.length > 0 && (
            <Card size="small" title={`${t('ytScraper.recordsSkipped')} (${data.skipped.length})`}>
              {data.skipped.map((item: any, i: number) => (
                <Tag key={i} color="orange" style={{ marginBottom: 4 }}>
                  {item.koc}: {item.reason}
                </Tag>
              ))}
            </Card>
          )}
        </div>
      )}
    </Modal>
  );
};

export default CreateRevenueResultModal;
