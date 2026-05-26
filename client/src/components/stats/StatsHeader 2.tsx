import { CloudDownloadOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, Typography } from 'antd';
import { AppSpin, AppTooltip } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

interface StatsHeaderProps {
  onRefresh: () => void;
  onFetchAll: () => void;
  fetchLoading: boolean;
}

const StatsHeader: React.FC<StatsHeaderProps> = ({ onRefresh, onFetchAll, fetchLoading }) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Space>
        <Title level={3} style={{ margin: 0 }}>
          {t('menu.stats')}
        </Title>
        <AppTooltip
          title={
            <div>
              <div style={{ marginBottom: 4 }}>
                <strong>{t('stats.ytStudioTooltipTitle')}</strong>
              </div>
              <div>• {t('stats.tooltipViews')}</div>
              <div>• {t('stats.tooltipWatchTime')}</div>
              <div>• {t('stats.tooltipSubscribers')}</div>
              <div>• {t('stats.tooltipRevenue')}</div>
              <div>• {t('stats.tooltipImpressions')}</div>
              <div>• {t('stats.tooltipLikes')}</div>
              <div>• {t('stats.tooltipAudience')}</div>
            </div>
          }
          placement="bottomLeft"
        >
          <QuestionCircleOutlined style={{ fontSize: 16, color: '#1677ff', cursor: 'help' }} />
        </AppTooltip>
      </Space>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
        <Button type="primary" icon={<CloudDownloadOutlined />} loading={fetchLoading} onClick={onFetchAll}>
          {t('stats.fetchSocialBlade')}
        </Button>
      </Space>
    </div>
  );
};

export default StatsHeader;
