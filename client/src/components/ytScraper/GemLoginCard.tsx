import { DesktopOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Badge, Card, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { gemloginApi } from '../../api';
import GemLoginProfileTable from './GemLoginProfileTable';
import GemLoginScrapeForm from './GemLoginScrapeForm';

const { Text } = Typography;

interface ScrapeResultItem {
  kocId?: string;
  fullName?: string;
  channelName?: string;
  channelId: string;
  estimatedRevenue: number | null;
  views: number | null;
  watchTimeHours: number | null;
  period: string;
  countries?: any[];
}

const GemLoginCard: React.FC = () => {
  const [detailItem, setDetailItem] = useState<ScrapeResultItem | null>(null);

  const { data: statusRes, isLoading } = useQuery({
    queryKey: ['gemlogin-status'],
    queryFn: () => gemloginApi.getStatus(),
    refetchInterval: 10000,
  });

  const status = statusRes?.data;
  const isRunning = status?.isRunning ?? false;

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <DesktopOutlined style={{ fontSize: 16 }} />
            <Text strong>GemLogin Anti-detect Browser</Text>
            <Badge
              status={isRunning ? 'success' : 'default'}
              text={isRunning ? 'Đang chạy' : 'Chưa khởi động'}
            />
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <GemLoginProfileTable
          status={status}
          isRunning={isRunning}
          isLoading={isLoading}
          detailItem={detailItem}
          setDetailItem={setDetailItem}
        />

        {/* Scrape controls — chỉ hiện khi đang chạy */}
        {isRunning && (
          <GemLoginScrapeForm onViewDetail={setDetailItem} />
        )}
      </Card>
    </>
  );
};

export default GemLoginCard;
