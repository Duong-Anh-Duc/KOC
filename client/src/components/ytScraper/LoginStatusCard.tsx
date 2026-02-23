import {
    ChromeOutlined,
    CloseCircleOutlined,
    LoadingOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface LoginStatusCardProps {
  statusData: any;
  statusLoading: boolean;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  openLoginLoading: boolean;
  onCloseBrowser: () => void;
  closeBrowserLoading: boolean;
}

const LoginStatusCard: React.FC<LoginStatusCardProps> = ({
  statusData,
  statusLoading,
  isLoggedIn,
  onOpenLogin,
  openLoginLoading,
  onCloseBrowser,
  closeBrowserLoading,
}) => {
  const { t } = useTranslation();

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space size="large">
            <Badge
              status={isLoggedIn ? 'success' : 'error'}
              text={
                <Text strong style={{ fontSize: 15 }}>
                  YouTube Studio: {isLoggedIn ? t('ytScraper.connected') : t('ytScraper.notConnected')}
                </Text>
              }
            />
            {statusData?.email && (
              <Tag icon={<UserOutlined />} color="blue">
                {statusData.email}
              </Tag>
            )}
            {statusLoading && <LoadingOutlined />}
          </Space>
        </Col>
        <Col>
          <Space>
            {!isLoggedIn ? (
              <Button
                type="primary"
                icon={<ChromeOutlined />}
                onClick={onOpenLogin}
                loading={openLoginLoading}
                size="large"
              >
                {t('ytScraper.openLogin')}
              </Button>
            ) : (
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={onCloseBrowser}
                loading={closeBrowserLoading}
              >
                {t('ytScraper.closeBrowser')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>
      {!isLoggedIn && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message={t('ytScraper.loginHint')}
        />
      )}
    </Card>
  );
};

export default LoginStatusCard;
