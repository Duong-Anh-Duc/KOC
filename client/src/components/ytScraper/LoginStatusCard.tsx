import {
    ChromeOutlined,
    LoadingOutlined,
    ReloadOutlined,
    SwapOutlined,
    UserOutlined,
    YoutubeOutlined,
} from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Popconfirm, Row, Space, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface LoginStatusCardProps {
  statusData: any;
  statusLoading: boolean;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  openLoginLoading: boolean;
  onChangeAccount: () => void;
  changeAccountLoading: boolean;
  onRefreshAccountInfo?: () => void;
  refreshAccountInfoLoading?: boolean;
}

const LoginStatusCard: React.FC<LoginStatusCardProps> = ({
  statusData,
  statusLoading,
  isLoggedIn,
  onOpenLogin,
  openLoginLoading,
  onChangeAccount,
  changeAccountLoading,
  onRefreshAccountInfo,
  refreshAccountInfoLoading,
}) => {
  const { t } = useTranslation();

  const channelName = statusData?.channelName;
  const email = statusData?.email;

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space size="middle" wrap>
            <Badge
              status={isLoggedIn ? 'success' : 'error'}
              text={
                <Text strong style={{ fontSize: 15 }}>
                  YouTube Studio: {isLoggedIn ? t('ytScraper.connected') : t('ytScraper.notConnected')}
                </Text>
              }
            />
            {isLoggedIn && channelName && (
              <Tag icon={<YoutubeOutlined />} color="red" style={{ fontSize: 13, padding: '2px 10px' }}>
                {channelName}
              </Tag>
            )}
            {isLoggedIn && email && (
              <Tag icon={<UserOutlined />} color="blue" style={{ fontSize: 12 }}>
                {email}
              </Tag>
            )}
            {isLoggedIn && !channelName && !email && !statusLoading && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('ytScraper.accountInfoUnknown')}
              </Text>
            )}
            {statusLoading && <LoadingOutlined />}
          </Space>
        </Col>
        <Col>
          <Space>
            {isLoggedIn && onRefreshAccountInfo && (
              <Tooltip title={t('ytScraper.refreshAccountInfo')}>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={onRefreshAccountInfo}
                  loading={refreshAccountInfoLoading}
                  size="small"
                />
              </Tooltip>
            )}
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
            ) : null}
            <Popconfirm
              title={t('ytScraper.changeAccount')}
              description={t('ytScraper.changeAccountConfirm')}
              onConfirm={onChangeAccount}
              okText={t('common.yes')}
              cancelText={t('common.no')}
              okButtonProps={{ danger: true }}
            >
              <Button
                icon={<SwapOutlined />}
                loading={changeAccountLoading}
              >
                {t('ytScraper.changeAccount')}
              </Button>
            </Popconfirm>
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
