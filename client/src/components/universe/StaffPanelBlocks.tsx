import React from 'react';
import { Button, Col, Divider, Empty, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
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

export const DashboardPanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const summary = overview?.latestCycleSummary;
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.dashboard')}</Paragraph>
      <Divider style={dividerStyle} />
      <Row gutter={12}>
        <Col span={8}>
          <Statistic
            title={<StatLabel>{t('universe.stats.activeKocs')}</StatLabel>}
            value={overview?.totalKOCs ?? 0}
            valueStyle={valueStyle}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<StatLabel>{t('universe.metrics.active')}</StatLabel>}
            value={overview?.activeKOCs ?? 0}
            valueStyle={valueStyle}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<StatLabel>{t('universe.stats.cycles')}</StatLabel>}
            value={overview?.totalCycles ?? 0}
            valueStyle={valueStyle}
          />
        </Col>
      </Row>
      <Divider style={dividerStyle} />
      <div style={cardStyle}>
        <Text strong style={{ color: '#fff' }}>
          {t('universe.drawer.latestCycle')}
        </Text>
        {summary ? (
          <>
            <div style={{ marginTop: 8 }}>
              <Tag color="orange">{summary.cycle?.month}</Tag>
            </div>
            <Row gutter={12} style={{ marginTop: 10 }}>
              <Col span={12}>
                <Statistic
                  title={<StatLabel>{t('universe.metrics.net')}</StatLabel>}
                  value={formatUSD(summary.totalNetRevenue)}
                  valueStyle={valueStyle}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<StatLabel>{t('universe.metrics.company')}</StatLabel>}
                  value={formatUSD(summary.totalCompanyShare)}
                  valueStyle={valueStyle}
                />
              </Col>
              <Col span={24} style={{ marginTop: 10 }}>
                <Statistic
                  title={<StatLabel>{t('universe.metrics.received')}</StatLabel>}
                  value={formatUSD(summary.totalKocReceiveUsd)}
                  valueStyle={valueStyle}
                />
              </Col>
            </Row>
          </>
        ) : (
          <div style={{ marginTop: 10 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={labelStyle}>{t('universe.drawer.noCycle')}</span>}
            />
          </div>
        )}
      </div>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const KocPanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const top = [...(overview?.growthSummary ?? [])]
    .sort((a, b) => (b.views_growth ?? 0) - (a.views_growth ?? 0))
    .slice(0, 5);
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.koc')}</Paragraph>
      <Divider style={dividerStyle} />
      <Row gutter={12}>
        <Col span={12}>
          <Statistic
            title={<StatLabel>{t('universe.stats.activeKocs')}</StatLabel>}
            value={`${overview?.activeKOCs ?? 0}/${overview?.totalKOCs ?? 0}`}
            valueStyle={valueStyle}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title={<StatLabel>{t('universe.metrics.active')}</StatLabel>}
            value={overview?.activeKOCs ?? 0}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#fff' }}>{item.full_name}</Text>
                  <Tag color="green">{formatNumber(item.views_growth, 2)}%</Tag>
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

export const RevenuePanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const summary = overview?.latestCycleSummary;
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.revenue')}</Paragraph>
      <Divider style={dividerStyle} />
      {summary ? (
        <>
          <Space>
            <Text style={labelStyle}>{t('universe.drawer.latestCycle')}</Text>
            <Tag color="orange">{summary.cycle?.month}</Tag>
          </Space>
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Statistic
                title={<StatLabel>Total Original</StatLabel>}
                value={formatUSD(summary.totalOriginal)}
                valueStyle={valueStyle}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={<StatLabel>{t('universe.metrics.net')}</StatLabel>}
                value={formatUSD(summary.totalNetRevenue)}
                valueStyle={valueStyle}
              />
            </Col>
            <Col span={12} style={{ marginTop: 12 }}>
              <Statistic
                title={<StatLabel>{t('universe.metrics.company')}</StatLabel>}
                value={formatUSD(summary.totalCompanyShare)}
                valueStyle={valueStyle}
              />
            </Col>
            <Col span={12} style={{ marginTop: 12 }}>
              <Statistic
                title={<StatLabel>{t('universe.metrics.received')} (USD)</StatLabel>}
                value={formatUSD(summary.totalKocReceiveUsd)}
                valueStyle={valueStyle}
              />
            </Col>
            <Col span={24} style={{ marginTop: 12 }}>
              <Statistic
                title={<StatLabel>{t('universe.metrics.received')} (VND)</StatLabel>}
                value={formatVND(summary.totalKocReceiveVnd)}
                valueStyle={valueStyle}
              />
            </Col>
          </Row>
        </>
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

export const StatsPanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const top = [...(overview?.growthSummary ?? [])]
    .sort((a, b) => (b.subs_growth ?? 0) - (a.subs_growth ?? 0))
    .slice(0, 5);
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.stats')}</Paragraph>
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
                <Text style={{ color: '#fff', display: 'block' }}>{item.full_name}</Text>
                <Space size={12} style={{ marginTop: 4 }}>
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {t('universe.drawer.views')}:{' '}
                    <span style={{ color: '#a5b4fc' }}>+{formatNumber(item.views_diff, 0)}</span>
                  </span>
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {t('universe.drawer.subs')}:{' '}
                    <span style={{ color: '#86efac' }}>+{formatNumber(item.subs_diff, 0)}</span>
                  </span>
                </Space>
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

export const SendEmailPanel: React.FC<PanelProps> = ({ overview, onOpen }) => {
  const { t } = useTranslation();
  const count = overview?.recentRecords?.length ?? 0;
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.sendEmail')}</Paragraph>
      <Divider style={dividerStyle} />
      <div style={cardStyle}>
        <Statistic
          title={<StatLabel>{t('universe.drawer.recentRecords')}</StatLabel>}
          value={count}
          valueStyle={valueStyle}
        />
      </div>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const AuditPanel: React.FC<PanelProps> = ({ auditLogs, onOpen }) => {
  const { t } = useTranslation();
  const logs = (auditLogs ?? []).slice(0, 5);
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.audit')}</Paragraph>
      <Divider style={dividerStyle} />
      <Text strong style={{ color: '#fff' }}>
        {t('universe.drawer.recentLogs')}
      </Text>
      {logs.length > 0 ? (
        <List
          dataSource={logs}
          split={false}
          style={{ marginTop: 8 }}
          renderItem={(log) => {
            const action = t(`audit.actions.${log.action}`, { defaultValue: log.action });
            const entity = t(`audit.entities.${log.entity}`, { defaultValue: log.entity });
            return (
              <List.Item style={listItemStyle}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Tag color="geekblue">{action}</Tag>
                    <Text style={{ color: '#e0e0e0' }}>{entity}</Text>
                  </Space>
                  <Text style={{ color: '#888', fontSize: 12 }}>
                    {dayjs(log.timestamp).format('HH:mm DD/MM')}
                  </Text>
                </div>
              </List.Item>
            );
          }}
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

export const UsersPanel: React.FC<PanelProps> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.users')}</Paragraph>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const CronPanel: React.FC<PanelProps> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.cron')}</Paragraph>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const EmailSettingsPanel: React.FC<PanelProps> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.email')}</Paragraph>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};

export const PermissionsPanel: React.FC<PanelProps> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <div>
      <Paragraph style={descStyle}>{t('universe.desc.permissions')}</Paragraph>
      <OpenButton onOpen={onOpen} />
    </div>
  );
};
