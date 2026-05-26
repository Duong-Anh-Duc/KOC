import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloudSyncOutlined,
  LoadingOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Grid, Space, Typography } from 'antd';
import { AppTag } from '../common';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle, RevenueRecord } from '../../types';

const { Text } = Typography;
const { useBreakpoint } = Grid;

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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const gemLoginScraping = scrapeLoading || scrapeMonthlyLoading;
  const recordKocIds = useMemo(() => records.map((r) => r.koc_id), [records]);

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 8 }}>
        <div style={{ flex: isMobile ? undefined : 'auto' }}>
          <Space size={isMobile ? 'small' : 'large'} wrap>
            <Text strong>
              {isMobile ? selectedCycle.month : `${t('revenue.month')}: ${selectedCycle.month}`}
            </Text>
            <Text style={{ fontSize: isMobile ? 12 : 14 }}>
              {isMobile ? '' : `${t('revenue.exchangeRate')}: `}
              <strong>{Number(selectedCycle.exchange_rate).toLocaleString()} {t('common.vndUsd')}</strong>
            </Text>
            <AppTag color={statusColorMap[selectedCycle.status]} style={{ margin: 0 }}>
              {t(`status.${selectedCycle.status}`, selectedCycle.status)}
            </AppTag>
          </Space>
        </div>
        <div>
          <Space wrap size="small">
            {canRunScraper && !cycleLocked && (
              <div className="revenue-action-grid">
              {/* AntD-original:
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
              */}
                <button
                  type="button"
                  className="revenue-action-button revenue-action-button-primary"
                  disabled={gemLoginScraping || checkPubCodesLoading}
                  onClick={() => onScrapeRevenue(selectedCycle.id, recordKocIds)}
                >
                  {gemLoginScraping ? <LoadingOutlined /> : <CloudSyncOutlined />}
                  <span>Cào tất cả</span>
                </button>
                <button
                  type="button"
                  className="revenue-action-button"
                  disabled={gemLoginScraping || checkPubCodesLoading}
                  onClick={onOpenGemLoginSelect}
                >
                  <TeamOutlined />
                  <span>Chọn KOC</span>
                </button>
                <button
                  type="button"
                  className="revenue-action-button"
                  disabled={gemLoginScraping || checkPubCodesLoading}
                  onClick={() => onScrapeMonthly(recordKocIds)}
                >
                  <CalendarOutlined />
                  <span>Cào tháng</span>
                </button>
                <button
                  type="button"
                  className="revenue-action-button"
                  disabled={gemLoginScraping || checkPubCodesLoading}
                  onClick={onOpenMonthlyModal}
                >
                  <TeamOutlined />
                  <span>Tháng/KOC</span>
                </button>
                <button
                  type="button"
                  className="revenue-action-button"
                  disabled={gemLoginScraping || checkPubCodesLoading || !onCheckPubCodes}
                  onClick={() => onCheckPubCodes?.(selectedCycle.id)}
                >
                  <SafetyCertificateOutlined />
                  <span>Kiểm Pub</span>
                </button>
              </div>
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
        </div>
      </div>
    </Card>
  );
};

export default RevenueToolbar;
