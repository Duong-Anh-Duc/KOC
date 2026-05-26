import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Col, Popconfirm, Row, Space, Tag, Tooltip, Typography } from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../common';
import React from 'react';
import { gologinApi } from '../../api';

const { Text } = Typography;

const GoLoginCard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: statusRes, isLoading } = useQuery({
    queryKey: ['gologin-status'],
    queryFn: () => gologinApi.getStatus(),
    refetchInterval: 5000,
  });

  const status = statusRes?.data?.data;

  const startMutation = useMutation({
    mutationFn: () => gologinApi.start(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gologin-status'] });
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => gologinApi.stop(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gologin-status'] });
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
  });

  const isRunning = status?.isRunning ?? false;

  return (
    <Card
      size="small"
      title={
        <Space>
          <img
            src="https://gologin.com/favicon.ico"
            width={16}
            height={16}
            alt="GoLogin"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <Text strong>GoLogin Anti-detect Browser</Text>
          <Badge
            status={isRunning ? 'success' : 'default'}
            text={isRunning ? 'Đang chạy' : 'Chưa khởi động'}
          />
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space wrap size="small">
            {isRunning && status?.profileId && (
              <AppTag icon={<CheckCircleOutlined />} color="success">
                Profile: {status.profileId}
              </AppTag>
            )}
            {isRunning && status?.cdpInjected && (
              <AppTag icon={<CheckCircleOutlined />} color="blue">
                CDP đã inject → Scraper dùng GoLogin
              </AppTag>
            )}
            {isRunning && !status?.cdpInjected && (
              <AppTag icon={<CloseCircleOutlined />} color="warning">
                CDP chưa inject
              </AppTag>
            )}
            {!isRunning && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bấm Khởi động để mở Orbita browser. Đăng nhập YouTube trong Orbita, sau đó cào như bình thường.
              </Text>
            )}
          </Space>
        </Col>
        <Col>
          <Space>
            {!isRunning ? (
              <AppTooltip title="Khởi động GoLogin profile. CDP URL sẽ tự inject vào scraper.">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={startMutation.isPending || isLoading}
                  onClick={() => startMutation.mutate()}
                >
                  Khởi động
                </Button>
              </AppTooltip>
            ) : (
              <Popconfirm
                title="Dừng GoLogin profile?"
                description="Browser sẽ đóng. Scraper sẽ không còn dùng GoLogin nữa."
                onConfirm={() => stopMutation.mutate()}
                okText="Dừng"
                cancelText="Huỷ"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={stopMutation.isPending}
                >
                  Dừng
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>
      {startMutation.isError && (
        <Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Lỗi: {(startMutation.error as any)?.response?.data?.message ?? String(startMutation.error)}
        </Text>
      )}
      {stopMutation.isError && (
        <Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Lỗi: {(stopMutation.error as any)?.response?.data?.message ?? String(stopMutation.error)}
        </Text>
      )}
    </Card>
  );
};

export default GoLoginCard;
