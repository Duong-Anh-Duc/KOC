import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloudSyncOutlined,
  DownOutlined,
  LoadingOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Dropdown, Row, Space, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle, RevenueRecord } from '../../types';

const { Text } = Typography;

const statusColorMap: Record<string, string> = {
  OPEN: 'blue',
  LOCKED: 'orange',
  COMPLETED: 'green',
  PAYMENT_COMPLETED: 'green',
};

interface RevenueToolbarProps {
  selectedCycle: RevenueCycle;
  cycleLocked: boolean;
  records: RevenueRecord[];
  isAdmin: boolean;
  canManageCycle: boolean;
  canRunScraper: boolean;
  onScrapeRevenue: (cycleId: number, kocIds?: string[]) => void;
  scrapeLoading: boolean;
  onScrapeMonthly: (kocIds?: string[]) => void;
  scrapeMonthlyLoading: boolean;
  onCheckPubCodes?: (cycleId: number) => void;
  checkPubCodesLoading?: boolean;
  onLockCycle: (id: number) => void;
  lockLoading: boolean;
  onCompleteCycle: (id: number) => void;
  completeLoading: boolean;
  addKocsLoading: boolean;
  missingKOCsCount: number;
  onOpenGemLoginSelect: () => void;
  onOpenMonthlyModal: () => void;
  onOpenAddKocModal: () => void;
}

const RevenueToolbar: React.FC<RevenueToolbarProps> = ({
  selectedCycle,
  cycleLocked,
  records,
  isAdmin,
  canManageCycle,
  canRunScraper,
  onScrapeRevenue,
  scrapeLoading,
  onScrapeMonthly,
  scrapeMonthlyLoading,
  onCheckPubCodes,
  checkPubCodesLoading,
  onLockCycle,
  lockLoading,
  onCompleteCycle,
  completeLoading,
  addKocsLoading,
  missingKOCsCount,
  onOpenGemLoginSelect,
  onOpenMonthlyModal,
  onOpenAddKocModal,
}) => {
  const { t } = useTranslation();
  const gemLoginScraping = scrapeLoading || scrapeMonthlyLoading;

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space size="large">
            <Text strong>
              {t('revenue.month')}: {selectedCycle.month}
            </Text>
            <Space size="small">
              <Text>
                {t('revenue.exchangeRate')}:{' '}
                <strong>{Number(selectedCycle.exchange_rate).toLocaleString()} {t('common.vndUsd')}</strong>
              </Text>
            </Space>
            <Tag color={statusColorMap[selectedCycle.status]}>
              {t(`status.${selectedCycle.status}`, selectedCycle.status)}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            {canRunScraper && !cycleLocked && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'gem-all',
                      label: 'Cào doanh thu — tất cả KOC',
                      icon: <CloudSyncOutlined />,
                      onClick: () => onScrapeRevenue(selectedCycle.id, records.map(r => r.koc_id)),
                    },
                    {
                      key: 'gem-select',
                      label: 'Cào doanh thu — chọn KOC',
                      icon: <TeamOutlined />,
                      onClick: onOpenGemLoginSelect,
                    },
                    { type: 'divider' },
                    {
                      key: 'gem-monthly-all',
                      label: 'Cào dữ liệu tháng — tất cả KOC',
                      icon: <CalendarOutlined />,
                      onClick: () => onScrapeMonthly(records.map(r => r.koc_id)),
                    },
                    {
                      key: 'gem-monthly-select',
                      label: 'Cào dữ liệu tháng — chọn KOC',
                      icon: <TeamOutlined />,
                      onClick: onOpenMonthlyModal,
                    },
                    { type: 'divider' },
                    {
                      key: 'check-pub-codes',
                      label: 'Kiểm tra Mã Pub toàn chu kỳ',
                      icon: <SafetyCertificateOutlined />,
                      onClick: () => onCheckPubCodes?.(selectedCycle.id),
                      disabled: checkPubCodesLoading || !onCheckPubCodes,
                    },
                  ],
                }}
                disabled={gemLoginScraping || checkPubCodesLoading}
              >
                <Button
                  type="primary"
                  icon={gemLoginScraping ? <LoadingOutlined /> : <CloudSyncOutlined />}
                  loading={gemLoginScraping}
                >
                  {t('revenue.updateRevenue')} <DownOutlined />
                </Button>
              </Dropdown>
            )}
            {canManageCycle && !cycleLocked && (
              <Button
                icon={addKocsLoading ? <LoadingOutlined /> : <PlusOutlined />}
                loading={addKocsLoading}
                onClick={onOpenAddKocModal}
                disabled={missingKOCsCount === 0}
                title={missingKOCsCount === 0 ? 'Tất cả KOC đã có trong chu kỳ' : undefined}
              >
                Thêm KOC ({missingKOCsCount})
              </Button>
            )}
            {canManageCycle && selectedCycle.status === 'OPEN' && (
              <Button
                icon={<LockOutlined />}
                onClick={() => onLockCycle(selectedCycle.id)}
                loading={lockLoading}
              >
                {t('cycle.lock')}
              </Button>
            )}
            {canManageCycle && selectedCycle.status === 'LOCKED' && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => onCompleteCycle(selectedCycle.id)}
                loading={completeLoading}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                {t('cycle.complete')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default RevenueToolbar;
