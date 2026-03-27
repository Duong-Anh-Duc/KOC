import {
  EyeOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Col,
  Collapse,
  DatePicker,
  Divider,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { Dayjs } from 'dayjs';
import React, { useState } from 'react';
import { gemloginApi, kocApi } from '../../api';
import { useProgress } from '../../hooks/useProgress';
import { TaskProgressBar } from '../common';

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

interface GemLoginScrapeFormProps {
  onViewDetail: (item: ScrapeResultItem) => void;
}

const GemLoginScrapeForm: React.FC<GemLoginScrapeFormProps> = ({ onViewDetail }) => {
  const queryClient = useQueryClient();
  const [scrapeResult, setScrapeResult] = useState<any>(null);
  const [cronResult, setCronResult] = useState<any>(null);
  const [waitSeconds, setWaitSeconds] = useState<number>(150);
  const [selectedKocIds, setSelectedKocIds] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Dayjs | null>(null);

  const { data: kocListRes } = useQuery({
    queryKey: ['koc-list-for-gemlogin'],
    queryFn: () => kocApi.getAll({ limit: 200 }),
    staleTime: 60_000,
  });
  const kocOptions = (kocListRes?.data?.data ?? []).map((k: any) => ({
    value: k.id,
    label: `${k.full_name} — ${k.channel_name}`,
  }));

  const scrapeProgress = useProgress((result: unknown) => {
    const data = result as any;
    setScrapeResult(data);
    message.success(`Cào xong: ${data?.success}/${data?.total} KOC thành công`);
    queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
    queryClient.invalidateQueries({ queryKey: ['cycles'] });
    queryClient.invalidateQueries({ queryKey: ['yt-scrape-latest-results'] });
    queryClient.invalidateQueries({ queryKey: ['monthlyRevenue'] });
  });

  const scrapeMutation = useMutation({
    mutationFn: () => gemloginApi.scrapeRevenue({
      closeAfter: false,
      waitSeconds,
      kocIds: selectedKocIds.length > 0 ? selectedKocIds : undefined,
      month: selectedMonth ? selectedMonth.format('MM/YYYY') : undefined,
      saveToDb: false,
    }),
    onSuccess: (res) => {
      const taskId = res.data?.data?.taskId;
      if (taskId) scrapeProgress.startTask(taskId);
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? String(err));
    },
  });

  const cronMutation = useMutation({
    mutationFn: () => gemloginApi.runCron({ closeAfter: false }),
    onSuccess: (res) => {
      setCronResult({ success: res.data?.success, message: res.data?.message, cycleMonth: res.data?.data?.cycleMonth });
      queryClient.invalidateQueries({ queryKey: ['yt-scrape-latest-results'] });
      queryClient.invalidateQueries({ queryKey: ['cycles-for-scraper'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-records'] });
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyRevenue'] });
      if (res.data?.success) {
        message.success(res.data?.message || 'Hoàn tất');
      } else {
        message.warning(res.data?.message || 'Không thể chạy cron');
      }
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? String(err));
    },
  });

  const isBusy = scrapeMutation.isPending || scrapeProgress.state.active || cronMutation.isPending;

  const scrapeResultColumns = [
    {
      title: 'KOC',
      key: 'koc',
      render: (_: any, r: ScrapeResultItem) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.fullName || '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>@{r.channelName || r.channelId}</Text>
        </div>
      ),
    },
    {
      title: 'Doanh thu ($)',
      dataIndex: 'estimatedRevenue',
      key: 'estimatedRevenue',
      render: (v: number | null) => (
        <Text strong style={{ color: v != null && v > 0 ? '#52c41a' : undefined }}>
          {v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </Text>
      ),
    },
    {
      title: 'Lượt xem',
      dataIndex: 'views',
      key: 'views',
      render: (v: number | null) => v != null ? v.toLocaleString() : '—',
    },
    {
      title: 'Kỳ',
      dataIndex: 'period',
      key: 'period',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '',
      key: 'action',
      render: (_: any, r: ScrapeResultItem) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onViewDetail(r)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <>
      <TaskProgressBar state={scrapeProgress.state} onDismiss={scrapeProgress.reset} />

      <Divider style={{ margin: '10px 0' }} />

      {/* Chọn KOC + tháng */}
      <Row gutter={[12, 8]} align="bottom" style={{ marginBottom: 10 }}>
        <Col flex="auto">
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Chọn KOC cần cào (để trống = cào tất cả):
          </Text>
          <Select
            mode="multiple"
            allowClear
            placeholder="Chọn KOC..."
            options={kocOptions}
            value={selectedKocIds}
            onChange={setSelectedKocIds}
            style={{ width: '100%' }}
            maxTagCount={3}
            disabled={isBusy}
            showSearch
            filterOption={(input, opt) =>
              (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Col>
        <Col>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tháng:</Text>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={setSelectedMonth}
            placeholder="Tháng hiện tại"
            style={{ width: 150 }}
            disabled={isBusy}
            format="MM/YYYY"
          />
        </Col>
      </Row>

      {/* Cấu hình + nút cào */}
      <Row gutter={[12, 8]} align="middle">
        <Col>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>Chờ (giây):</Text>
            <InputNumber
              min={30} max={600} value={waitSeconds}
              onChange={(v) => setWaitSeconds(v ?? 150)}
              size="small" style={{ width: 68 }}
              disabled={isBusy}
            />
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={scrapeMutation.isPending || scrapeProgress.state.active}
            disabled={isBusy}
            onClick={() => { setScrapeResult(null); scrapeProgress.reset(); scrapeMutation.mutate(); }}
          >
            {selectedKocIds.length > 0
              ? `Cào ${selectedKocIds.length} KOC${selectedMonth ? ` tháng ${selectedMonth.format('MM/YYYY')}` : ''}`
              : 'Cào tất cả KOC'}
          </Button>
        </Col>
        <Col>
          <Tooltip title="Chạy full cron: tạo cycle tháng trước + cào doanh thu + lưu records">
            <Button
              icon={<RocketOutlined />}
              loading={cronMutation.isPending}
              disabled={isBusy && !cronMutation.isPending}
              onClick={() => { setCronResult(null); cronMutation.mutate(); }}
            >
              Chạy cron đầy đủ
            </Button>
          </Tooltip>
        </Col>
      </Row>

      {/* Kết quả cào doanh thu */}
      {scrapeResult && (
        <div style={{ marginTop: 12 }}>
          <Alert
            type={scrapeResult.failed === 0 ? 'success' : 'warning'}
            message={`Kết quả cào: ${scrapeResult.success}/${scrapeResult.total} KOC thành công${scrapeResult.savedToDb ? ' (đã lưu DB)' : ''}`}
            style={{ marginBottom: 8 }}
            closable
            onClose={() => setScrapeResult(null)}
          />
          {scrapeResult.results?.length > 0 && (
            <Table
              dataSource={scrapeResult.results}
              columns={scrapeResultColumns}
              rowKey={(r: ScrapeResultItem) => r.kocId ?? r.channelId}
              size="small"
              pagination={false}
              scroll={{ x: true }}
            />
          )}
          {scrapeResult.errors?.length > 0 && (
            <Collapse
              size="small"
              style={{ marginTop: 8 }}
              items={[{
                key: 'err',
                label: <Text type="danger">{scrapeResult.errors.length} lỗi</Text>,
                children: scrapeResult.errors.map((e: any) => (
                  <div key={e.channelId} style={{ fontSize: 12 }}>
                    <Text code>{e.channelId}</Text>: {e.error}
                  </div>
                )),
              }]}
            />
          )}
        </div>
      )}

      {/* Kết quả chạy cron */}
      {cronResult && (
        <Alert
          type={cronResult.success ? 'success' : 'warning'}
          message={cronResult.message}
          description={cronResult.cycleMonth ? `Chu kỳ: ${cronResult.cycleMonth}` : undefined}
          style={{ marginTop: 12 }}
          closable
          onClose={() => setCronResult(null)}
        />
      )}
    </>
  );
};

export default GemLoginScrapeForm;
