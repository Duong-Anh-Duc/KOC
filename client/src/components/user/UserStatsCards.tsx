import { CheckCircleOutlined, SolutionOutlined, TeamOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Card, Col, Row, Statistic } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  total: number;
  activeCount: number;
  accountantCount: number;
  viewerCount: number;
}

const UserStatsCards: React.FC<Props> = ({ total, activeCount, accountantCount, viewerCount }) => {
  const { t } = useTranslation();
  return (
    <Row gutter={16} style={{ marginBottom: 20 }}>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ borderRadius: 10, borderColor: '#f0f0f0' }}>
          <Statistic
            title={<span style={{ fontSize: 12 }}>Tổng người dùng</span>}
            value={total}
            prefix={<TeamOutlined style={{ color: '#ED8F3A' }} />}
            valueStyle={{ color: '#ED8F3A', fontSize: 22, fontWeight: 700 }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ borderRadius: 10, borderColor: '#f0f0f0' }}>
          <Statistic
            title={<span style={{ fontSize: 12 }}>Đang hoạt động</span>}
            value={activeCount}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a', fontSize: 22, fontWeight: 700 }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ borderRadius: 10, borderColor: '#f0f0f0' }}>
          <Statistic
            title={<span style={{ fontSize: 12 }}>{t('users.roleAccountant')}</span>}
            value={accountantCount}
            prefix={<SolutionOutlined style={{ color: '#0958d9' }} />}
            valueStyle={{ color: '#0958d9', fontSize: 22, fontWeight: 700 }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={{ borderRadius: 10, borderColor: '#f0f0f0' }}>
          <Statistic
            title={<span style={{ fontSize: 12 }}>{t('users.roleViewer')}</span>}
            value={viewerCount}
            prefix={<VideoCameraOutlined style={{ color: '#d46b08' }} />}
            valueStyle={{ color: '#d46b08', fontSize: 22, fontWeight: 700 }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default UserStatsCards;
