import { Card, Col, Row, Statistic } from 'antd';
import React, { ReactNode } from 'react';

export interface SummaryItem {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
  precision?: number;
  valueStyle?: React.CSSProperties;
  formatter?: (value: number | string) => string;
}

interface SummaryBarProps {
  items: SummaryItem[];
  loading?: boolean;
}

const SummaryBar: React.FC<SummaryBarProps> = ({ items, loading = false }) => {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }} wrap={false}>
      {items.map((item, index) => (
        <Col flex="1" key={index} style={{ minWidth: 0 }}>
          <Card loading={loading} size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic
              title={<span style={{ fontSize: 12 }}>{item.title}</span>}
              value={item.value}
              prefix={item.prefix}
              suffix={item.suffix}
              precision={item.precision}
              valueStyle={{ ...item.valueStyle, fontSize: 18 }}
              formatter={item.formatter}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default SummaryBar;
