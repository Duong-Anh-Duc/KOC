import { Card, Col, Grid, Row, Statistic } from 'antd';
import React, { ReactNode } from 'react';

const { useBreakpoint } = Grid;

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
  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 16 }} wrap>
      {items.map((item, index) => (
        <Col
          key={index}
          xs={items.length <= 3 ? 8 : 12}
          sm={0}
          style={{ minWidth: 0, animationDelay: `${index * 0.08}s` }}
          flex={isMobile ? undefined : '1'}
        >
          <Card
            loading={loading}
            size="small"
            styles={{ body: { padding: isMobile ? '8px 10px' : '10px 14px' } }}
            style={{ border: `1px solid ${item.borderColor || defaultBorderColors[index % defaultBorderColors.length]}` }}
          >
            <Statistic
              title={<span style={{ fontSize: isMobile ? 11 : 12 }}>{item.title}</span>}
              value={item.value}
              prefix={isMobile ? undefined : item.prefix}
              suffix={item.suffix}
              precision={item.precision}
              valueStyle={{ ...item.valueStyle, fontSize: isMobile ? 14 : 18 }}
              formatter={item.formatter}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default SummaryBar;
