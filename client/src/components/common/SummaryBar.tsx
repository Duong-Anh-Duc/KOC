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
  const getColSpan = (itemCount: number) => {
    if (itemCount === 1) return 24;
    if (itemCount === 2) return 12;
    if (itemCount === 3) return 8;
    if (itemCount === 4) return 6;
    return 24 / itemCount;
  };

  const span = getColSpan(items.length);

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {items.map((item, index) => (
        <Col xs={24} sm={12} lg={span} key={index}>
          <Card loading={loading}>
            <Statistic
              title={item.title}
              value={item.value}
              prefix={item.prefix}
              suffix={item.suffix}
              precision={item.precision}
              valueStyle={item.valueStyle}
              formatter={item.formatter}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default SummaryBar;
