import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  DesktopOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Popconfirm,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import React, { useState } from 'react';
import { gemloginApi } from '../../api';

const { Text, Title } = Typography;

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

interface GemLoginProfileTableProps {
  status: any;
  isRunning: boolean;
  isLoading: boolean;
  detailItem: ScrapeResultItem | null;
  setDetailItem: (item: ScrapeResultItem | null) => void;
}

const GemLoginProfileTable: React.FC<GemLoginProfileTableProps> = ({
  status,
  isRunning,
  isLoading,
  detailItem,
  setDetailItem,
}) => {
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: () => gemloginApi.start(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gemlogin-status'] });
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      message.success('GemLogin đã khởi động — sẵn sàng cào dữ liệu');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? String(err));
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => gemloginApi.close(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gemlogin-status'] });
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      message.success('Đã đóng GemLogin profile');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? String(err));
    },
  });

  return (
    <>
      {/* Status row */}
      <Row gutter={16} align="middle" style={{ marginBottom: isRunning ? 12 : 0 }}>
        <Col flex="auto">
          <Space wrap size="small">
            {isRunning && status?.activeProfileId && (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Profile: {status.activeProfileId}
              </Tag>
            )}
            {isRunning && status?.cdpInjected && (
              <Tag icon={<CheckCircleOutlined />} color="blue">
                CDP đã inject → Scraper dùng GemLogin
              </Tag>
            )}
            {isRunning && !status?.cdpInjected && (
              <Tag icon={<CloseCircleOutlined />} color="warning">
                CDP chưa inject
              </Tag>
            )}
            {!isRunning && startMutation.isPending && (
              <Space size="small">
                <Spin size="small" />
                <Text type="warning" style={{ fontSize: 12 }}>
                  GemLogin đang khởi động browser... có thể mất <b>30–90 giây</b>, vui lòng chờ.
                </Text>
              </Space>
            )}
            {!isRunning && !startMutation.isPending && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bấm <b>Khởi động</b> để mở profile GemLogin (đã đăng nhập sẵn).
                Sau đó cào dữ liệu trực tiếp — không cần cấu hình cookie.
              </Text>
            )}
          </Space>
        </Col>
        <Col>
          <Space>
            {!isRunning ? (
              <Tooltip title="Mở profile GemLogin ID=1. CDP URL sẽ tự inject vào scraper.">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={startMutation.isPending || isLoading}
                  onClick={() => startMutation.mutate()}
                >
                  Khởi động
                </Button>
              </Tooltip>
            ) : (
              <Popconfirm
                title="Đóng GemLogin profile?"
                description="Browser sẽ đóng. Scraper sẽ không còn dùng GemLogin nữa."
                onConfirm={() => closeMutation.mutate()}
                okText="Đóng"
                cancelText="Huỷ"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<StopOutlined />} loading={closeMutation.isPending}>
                  Đóng
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      {/* Drawer xem chi tiết doanh thu 1 KOC */}
      <Drawer
        title={
          <Space>
            <DollarOutlined />
            <span>{detailItem?.fullName || detailItem?.channelName || detailItem?.channelId}</span>
            {detailItem?.period && <Tag color="blue">{detailItem.period}</Tag>}
          </Space>
        }
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        width={560}
      >
        {detailItem && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                    {detailItem.estimatedRevenue != null
                      ? `$${detailItem.estimatedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </Title>
                  <Text type="secondary">Doanh thu ước tính</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Title level={3} style={{ margin: 0 }}>
                    {detailItem.views != null ? detailItem.views.toLocaleString() : '—'}
                  </Title>
                  <Text type="secondary">Lượt xem</Text>
                </Card>
              </Col>
            </Row>

            <Text type="secondary" style={{ fontSize: 12 }}>Channel ID: </Text>
            <Text code style={{ fontSize: 12 }}>{detailItem.channelId}</Text>

            {detailItem.countries && detailItem.countries.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>Theo quốc gia</Divider>
                <Table
                  size="small"
                  dataSource={detailItem.countries.slice(0, 20)}
                  rowKey={(r: any) => r.country}
                  pagination={false}
                  columns={[
                    { title: 'Quốc gia', dataIndex: 'country', key: 'country' },
                    {
                      title: 'Doanh thu ($)',
                      dataIndex: 'estimatedRevenue',
                      key: 'rev',
                      render: (v: number | null) => v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
                    },
                    {
                      title: 'Lượt xem',
                      dataIndex: 'views',
                      key: 'views',
                      render: (v: number | null) => v?.toLocaleString() ?? '—',
                    },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
};

export default GemLoginProfileTable;
