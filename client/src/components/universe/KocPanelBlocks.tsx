import React from 'react';
import { Button, Col, Divider, Empty, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { AppTag } from '../common';
import { useTranslation } from 'react-i18next';
import type { AuditLog, DashboardOverview } from '../../types';
import { formatNumber, formatUSD, formatVND } from '../../utils';

const { Text, Paragraph } = Typography;

interface PanelProps {
  overview: DashboardOverview | undefined;
  auditLogs: AuditLog[] | undefined;
  onOpen: () => void;
}

const labelStyle: React.CSSProperties = { color: '#888' };
const valueStyle: React.CSSProperties = { color: '#fff' };
const descStyle: React.CSSProperties = { color: '#b0b0b0', marginBottom: 0 };
const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: 12,
};
const dividerStyle: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.08)',
  margin: '14px 0',
};
const listItemStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  padding: '8px 0',
};

const OpenButton: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <>
      <Divider style={dividerStyle} />
      <Button type="primary" block onClick={onOpen}>
        {t('universe.drawer.open')}
      </Button>
    </>
  );
};

const StatLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={labelStyle}>{children}</Text>
);

export const MyRevenuePanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const summary = overview?.latestCycleSummary;
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.myRevenue')}</Paragraph>
      <Divider style={dividerStyle} />
      {summary ? (
        <div style={cardStyle}>
          <Space>
            <Text style={labelStyle}>{t('universe.drawer.latestCycle')}</Text>
            <AppTag color="orange">{summary.cycle?.month}</AppTag>
          </Space>
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Statistic
                title={<StatLabel>{t('universe.metrics.received')} (USD)</StatLabel>}
                value={formatUSD(summary.totalKocReceiveUsd)}
                valueStyle={valueStyle}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={<StatLabel>{t('universe.metrics.received')} (VND)</StatLabel>}
                value={formatVND(summary.totalKocReceiveVnd)}
                valueStyle={valueStyle}
              />
            </Col>
          </Row>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={labelStyle}>{t('universe.drawer.noCycle')}</span>}
        />
      )}
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const ClockPanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const summary = overview?.latestCycleSummary;
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.clock')}</Paragraph>
      <Divider style={dividerStyle} />
      <div style={cardStyle}>
        <Text strong style={{ color: '#fff' }}>
          {t('universe.drawer.latestCycle')}
        </Text>
        {summary ? (
          <div style={{ marginTop: 10 }}>
            <Statistic
              title={<StatLabel>{t('universe.metrics.period')}</StatLabel>}
              value={summary.cycle?.month ?? '—'}
              valueStyle={{ ...valueStyle, fontSize: 28 }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={labelStyle}>{t('universe.drawer.noCycle')}</span>}
            />
          </div>
        )}
      </div>
      <Divider style={dividerStyle} />
      <Row gutter={12}>
        <Col span={24}>
          <Statistic
            title={<StatLabel>{t('universe.metrics.cycles')}</StatLabel>}
            value={overview?.totalCycles ?? 0}
            valueStyle={valueStyle}
          />
        </Col>
      </Row>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const GrowthPanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const items = overview?.growthSummary ?? [];
  const total = items.length;
  const top = [...items]
    .sort((a, b) => (b.subs_growth ?? 0) - (a.subs_growth ?? 0))
    .slice(0, 3);
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.growth')}</Paragraph>
      <Divider style={dividerStyle} />
      <Row gutter={12}>
        <Col span={24}>
          <Statistic
            title={<StatLabel>{t('universe.metrics.growth')}</StatLabel>}
            value={total}
            valueStyle={valueStyle}
          />
        </Col>
      </Row>
      <Divider style={dividerStyle} />
      <Text strong style={{ color: '#fff' }}>
        {t('universe.drawer.topGrowth')}
      </Text>
      {top.length > 0 ? (
        <List
          dataSource={top}
          split={false}
          style={{ marginTop: 8 }}
          renderItem={(item) => (
            <List.Item style={listItemStyle}>
              <div style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff' }}>{item.full_name}</Text>
                  <AppTag color="green">{formatNumber(item.subs_growth, 2)}%</AppTag>
                </div>
                <Text style={{ color: '#888', fontSize: 12 }}>{item.channel_name}</Text>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <div style={{ marginTop: 10 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={labelStyle}>{t('universe.drawer.noData')}</span>}
          />
        </div>
      )}
      <OpenButton onOpen={onOpen} />
    </div>
  );
};
