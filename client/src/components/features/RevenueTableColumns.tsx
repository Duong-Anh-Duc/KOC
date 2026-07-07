import type { PaymentStatusMap, RevenueRecord } from '@/types';
import { confirmAction, formatUSD, formatVND } from '@/utils';
import {
    BarChartOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    QuestionCircleOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../common';
import type { ColumnsType } from 'antd/es/table';
import type { TFunction } from 'i18next';

const { Text } = Typography;

export interface RevenueColumnsParams {
  t: TFunction;
  cycleLocked?: boolean;
  onApprove?: (id: string) => void;
  onUnapprove?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (record: RevenueRecord) => void;
  isAdmin?: boolean;
  canApprove?: boolean;
  canDelete?: boolean;
  scrapeResults?: unknown[];
  paymentStatus?: PaymentStatusMap;
  onViewDetail: (kocId: string) => void;
  onViewMonthly: (record: RevenueRecord) => void;
  onViewAccumulated?: (record: RevenueRecord) => void;
}

export function getRevenueColumns(params: RevenueColumnsParams): ColumnsType<RevenueRecord> {
  const {
    t,
    cycleLocked,
    onApprove,
    onUnapprove,
    onDelete,
    onEdit,
    isAdmin,
    canApprove,
    canDelete,
    scrapeResults,
    paymentStatus,
    onViewDetail,
    onViewMonthly,
    onViewAccumulated,
  } = params;

  return [
    {
      title: t('common.stt'),
      key: 'stt',
      fixed: 'left',
      width: 55,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('koc.fullName'),
      dataIndex: ['koc', 'full_name'],
      key: 'koc_name',
      fixed: 'left',
      width: 160,
      ellipsis: { showTitle: false },
      render: (val: string) => (
        <AppTooltip title={val} placement="topLeft">
          <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '-'}</Text>
        </AppTooltip>
      ),
    },
    {
      title: t('koc.channelName'),
      dataIndex: ['koc', 'channel_name'],
      key: 'channel_name',
      width: 140,
      ellipsis: { showTitle: false },
      render: (val: string) => val ? (
        <AppTooltip title={val} placement="topLeft">
          <Text style={{ color: '#1677ff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</Text>
        </AppTooltip>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('revenue.originalRevenue'),
      dataIndex: 'original_revenue_usd',
      key: 'original_revenue_usd',
      width: 130,
      align: 'right',
      render: (val: number, record: RevenueRecord) => {
        const status = paymentStatus?.[record.koc_id];
        const belowThreshold = status?.belowThreshold;
        const tooltipContent = status && belowThreshold ? (
          <div>
            <div style={{ marginBottom: 4 }}>
              {t('revenue.belowThresholdTitle', { threshold: `$${status.threshold}` })}
            </div>
            <div style={{ marginBottom: 4 }}>
              {t('revenue.accumulatedTotal')}: <strong>${status.accumulated.toFixed(2)}</strong>
            </div>
            {status.accumulatedMonths.map((m, i) => (
              <div key={i} style={{ fontSize: 12 }}>
                {m.month}: ${m.revenue.toFixed(2)}
              </div>
            ))}
          </div>
        ) : null;
        return (
          <span>
            {formatUSD(val)}
            {record.status === 'PENDING' && belowThreshold && tooltipContent && (
              <AppTooltip title={tooltipContent}>
                <WarningOutlined style={{ color: '#faad14', marginLeft: 6, fontSize: 12 }} />
              </AppTooltip>
            )}
          </span>
        );
      },
    },
    {
      title: t('revenue.accumulated'),
      dataIndex: 'accumulated_revenue_usd',
      key: 'accumulated_revenue_usd',
      width: 130,
      align: 'right',
      responsive: ['lg'],
      render: (val: number, record: RevenueRecord) => {
        const isIntermediate = record.paid_in_cycle_id != null && record.paid_in_cycle_id !== record.cycle_id;
        if (isIntermediate) {
          return <Text type="secondary">-</Text>;
        }
        const acc = Number(val || 0);
        const clickable = !!onViewAccumulated && acc !== 0;
        return (
          <Text
            strong
            onClick={clickable ? () => onViewAccumulated!(record) : undefined}
            style={{
              color: acc > 0 ? '#722ed1' : undefined,
              cursor: clickable ? 'pointer' : undefined,
              textDecoration: clickable ? 'underline dotted' : undefined,
            }}
          >
            {formatUSD(acc)}
          </Text>
        );
      },
    },
    {
      title: t('revenue.usTax'),
      dataIndex: 'accumulated_us_tax',
      key: 'accumulated_us_tax',
      width: 120,
      align: 'right',
      responsive: ['xl'],
      render: (_: unknown, record: RevenueRecord) => formatUSD(Number(record.accumulated_us_tax ?? record.us_tax_deduction)),
    },
    {
      title: t('revenue.bankFee'),
      dataIndex: 'accumulated_bank_fee',
      key: 'accumulated_bank_fee',
      width: 120,
      align: 'right',
      responsive: ['xl'],
      render: (_: unknown, record: RevenueRecord) => formatUSD(Number(record.accumulated_bank_fee ?? record.bank_fee)),
    },
    {
      title: t('revenue.netRevenue'),
      dataIndex: 'accumulated_net_revenue',
      key: 'accumulated_net_revenue',
      width: 140,
      align: 'right',
      responsive: ['lg'],
      render: (_: unknown, record: RevenueRecord) => (
        <strong>{formatUSD(Math.max(0, Number(record.accumulated_net_revenue ?? record.net_revenue)))}</strong>
      ),
    },
    {
      title: t('revenue.companyShare'),
      dataIndex: 'accumulated_company_share',
      key: 'accumulated_company_share',
      width: 130,
      align: 'right',
      responsive: ['xl'],
      render: (_: unknown, record: RevenueRecord) => formatUSD(Number(record.accumulated_company_share ?? record.company_share)),
    },
    {
      title: t('revenue.kocShareGross'),
      dataIndex: 'accumulated_koc_gross',
      key: 'accumulated_koc_gross',
      width: 130,
      align: 'right',
      responsive: ['xl'],
      render: (_: unknown, record: RevenueRecord) => formatUSD(Number(record.accumulated_koc_gross ?? record.koc_share_gross)),
    },
    {
      title: t('revenue.kocTax'),
      dataIndex: 'accumulated_koc_tax',
      key: 'accumulated_koc_tax',
      width: 120,
      align: 'right',
      responsive: ['lg'],
      render: (_: unknown, record: RevenueRecord) => formatUSD(Number(record.accumulated_koc_tax ?? record.koc_tax_deduction)),
    },
    {
      title: t('revenue.kocReceiveUsd'),
      dataIndex: 'accumulated_koc_usd',
      key: 'accumulated_koc_usd',
      width: 130,
      align: 'right',
      render: (_: unknown, record: RevenueRecord) => (
        <Text style={{ color: '#1677ff', fontSize: 13 }}>{formatUSD(Math.max(0, Number(record.accumulated_koc_usd ?? record.koc_receive_usd)))}</Text>
      ),
    },
    {
      title: t('revenue.accumulatedKocUsd'),
      dataIndex: 'accumulated_koc_usd',
      key: 'accumulated_koc_usd_badge',
      width: 140,
      align: 'right',
      responsive: ['lg'],
      render: (val: number, record: RevenueRecord) => {
        const isIntermediate = record.paid_in_cycle_id != null && record.paid_in_cycle_id !== record.cycle_id;
        if (isIntermediate) return <Text type="secondary">-</Text>;
        const acc = Number(val || 0);
        const color = acc < 0 ? '#ff4d4f' : acc > 0 ? '#1677ff' : undefined;
        return <Text strong style={{ color, fontSize: 13 }}>{formatUSD(acc)}</Text>;
      },
    },
    {
      title: t('revenue.kocReceiveVnd'),
      dataIndex: 'accumulated_koc_vnd',
      key: 'accumulated_koc_vnd',
      width: 160,
      align: 'right',
      render: (_: unknown, record: RevenueRecord) => (
        <Text strong style={{ color: '#52c41a', fontSize: 13 }}>
          {formatVND(Math.max(0, Number(record.accumulated_koc_vnd ?? record.koc_receive_vnd)))}
        </Text>
      ),
    },
    {
      title: t('revenue.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (status: string) => (
        <AppTag
          color={status === 'APPROVED' ? 'success' : 'warning'}
          style={{ fontWeight: 600, minWidth: 64, textAlign: 'center', borderRadius: 12 }}
        >
          {status === 'APPROVED' ? t('status.approved') : t('status.pending')}
        </AppTag>
      ),
    },
    {
      title: t('revenue.pubCodeCheck'),
      key: 'pub_code_check',
      width: 110,
      align: 'center',
      responsive: ['md'],
      render: (_: unknown, record: RevenueRecord) => {
        const stored = record.koc?.pub_code || null;
        const scraped = record.scraped_pub_code;
        const match = record.pub_code_match;

        if (match === true) {
          return (
            <AppTooltip title={t('revenue.pubCodeMatched', { code: scraped })}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            </AppTooltip>
          );
        } else if (match === false) {
          return (
            <AppTooltip title={t('revenue.pubCodeMismatch', { stored, scraped })}>
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            </AppTooltip>
          );
        } else {
          return (
            <AppTooltip title={t('revenue.pubCodeNotScraped')}>
              <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />
            </AppTooltip>
          );
        }
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      fixed: 'right',
      width: 120,
      align: 'center',
      render: (_: unknown, record: RevenueRecord) => (
        <Space size="small">
          {/* Monthly Revenue Analytics button */}
          <AppTooltip title={t('ytScraper.viewMonthlyRevenue')}>
            <Button
              type="text"
              size="small"
              icon={<BarChartOutlined style={{ color: '#ED8F3A' }} />}
              onClick={() => onViewMonthly(record)}
              style={{ padding: '4px 8px' }}
            />
          </AppTooltip>
          {scrapeResults && (
            <AppTooltip title={t('common.viewDetails')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ color: '#722ed1' }} />}
                onClick={() => onViewDetail(record.koc_id)}
                style={{ padding: '4px 8px' }}
              />
            </AppTooltip>
          )}
          {!cycleLocked && onEdit && (
            <AppTooltip title={t('common.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#1677ff' }} />}
                onClick={() => onEdit(record)}
                style={{ padding: '4px 8px' }}
              />
            </AppTooltip>
          )}
          {canApprove && record.status === 'PENDING' && onApprove && (() => {
            const status = paymentStatus?.[record.koc_id];
            const belowThreshold = status?.belowThreshold;
            return belowThreshold ? (
              <AppTooltip title={t('revenue.cannotApproveThreshold', { accumulated: status?.accumulated?.toFixed(2), threshold: status?.threshold ?? 100 })}>
                <Button
                  type="text"
                  size="small"
                  icon={<WarningOutlined style={{ color: '#faad14' }} />}
                  disabled
                  style={{ padding: '4px 8px' }}
                />
              </AppTooltip>
            ) : (
              <AppTooltip title={t('revenue.approve')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => onApprove(record.id)}
                  style={{ padding: '4px 8px' }}
                />
              </AppTooltip>
            );
          })()}
          {canApprove && record.status === 'APPROVED' && onUnapprove && (
            <AppTooltip title={t('revenue.unapprove')}>
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                onClick={() => confirmAction({
                  title: t('confirm.unapprove'),
                  okText: t('common.yes'),
                  cancelText: t('common.no'),
                  onConfirm: () => onUnapprove(record.id),
                })}
                style={{ padding: '4px 8px' }}
              />
            </AppTooltip>
          )}
          {canDelete && !cycleLocked && onDelete && (
            <Popconfirm
              title={t('confirm.delete')}
              onConfirm={() => onDelete(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <AppTooltip title={t('common.delete')}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
                  style={{ padding: '4px 8px' }}
                />
              </AppTooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
}
