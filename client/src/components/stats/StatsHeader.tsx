import { CloudDownloadOutlined, QuestionCircleOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

interface StatsHeaderProps {
  onRefresh: () => void;
  onFetchAll: () => void;
  fetchLoading: boolean;
  onOpenCronConfig?: () => void;
}

const StatsHeader: React.FC<StatsHeaderProps> = ({ onRefresh, onFetchAll, fetchLoading, onOpenCronConfig }) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
      <Space>
        <Title level={3} style={{ margin: 0 }}>
          {t('menu.stats')}
        </Title>
        <Tooltip
          title={
            <div>
              <div style={{ marginBottom: 4 }}>
                <strong>{t('stats.ytStudioTooltipTitle')}</strong>
              </div>
              <div style={{ marginBottom: 6 }}>{t('stats.ytStudioTooltipDesc')}</div>
              <div>• {t('stats.tooltipViews')}</div>
              <div>• {t('stats.tooltipWatchTime')}</div>
              <div>• {t('stats.tooltipSubscribers')}</div>
              <div>• {t('stats.tooltipRevenue')}</div>
              <div>• {t('stats.tooltipLikes')}</div>
              <div>• {t('stats.sharesFull')}</div>
            </div>
          }
          placement="bottomLeft"
        >
          <QuestionCircleOutlined style={{ fontSize: 16, color: '#1677ff', cursor: 'help' }} />
        </Tooltip>
      </Space>
      <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
        {onOpenCronConfig && (
          <Button icon={<SettingOutlined />} onClick={onOpenCronConfig}>
            {t('stats.cronConfig')}
          </Button>
        )}
        <Button type="primary" icon={<CloudDownloadOutlined />} loading={fetchLoading} onClick={onFetchAll}>
          {t('stats.fetchSocialBlade')}
        </Button>
      </Space>
    </div>
  );
};

export default StatsHeader;
