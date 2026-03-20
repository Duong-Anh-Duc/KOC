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
  borderColor?: string;
}

interface SummaryBarProps {
  items: SummaryItem[];
  loading?: boolean;
}

const defaultBorderColors = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#fa8c16'];

const SummaryBar: React.FC<SummaryBarProps> = ({ items, loading = false }) => {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }} wrap={false}>
      {items.map((item, index) => (
        <Col flex="1" key={index} style={{ minWidth: 0, animationDelay: `${index * 0.08}s` }}>
          <Card
            loading={loading}
            size="small"
            styles={{ body: { padding: '10px 14px' } }}
            style={{ border: `1px solid ${item.borderColor || defaultBorderColors[index % defaultBorderColors.length]}` }}
          >
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
