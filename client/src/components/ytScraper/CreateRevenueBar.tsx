import { DollarOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle } from '../../types';
import { NativeSelect } from '../common';

const { Text } = Typography;

interface CreateRevenueBarProps {
  cyclesData: RevenueCycle[] | undefined;
  selectedCycleId: number | null;
  onCycleChange: (id: number | null) => void;
  onCreateRecords: () => void;
  createLoading: boolean;
  disabled: boolean;
}

const CreateRevenueBar: React.FC<CreateRevenueBarProps> = ({
  cyclesData,
  selectedCycleId,
  onCycleChange,
  onCreateRecords,
  createLoading,
  disabled,
}) => {
  const { t } = useTranslation();

  return (
    <Card style={{ marginBottom: 16 }} size="small">
      <Row gutter={16} align="middle">
        <Col>
          <DollarOutlined style={{ fontSize: 18, color: '#52c41a', marginRight: 8 }} />
          <Text strong>{t('ytScraper.createRevenueFromScrape')}</Text>
        </Col>
        <Col>
          {/* AntD-original: <Select .../> */}
          <NativeSelect
            style={{ width: 220 }}
            placeholder={t('revenue.selectCycle')}
            value={selectedCycleId}
            onChange={(v) => onCycleChange(v ? Number(v) : null)}
            allowClear
            options={(cyclesData || [])
              .filter((c: RevenueCycle) => c.status === 'OPEN')
              .map((c: RevenueCycle) => ({
                value: c.id,
                label: `${c.month} - ${t(`status.${c.status}`, c.status)}`,
              }))}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<DollarOutlined />}
            onClick={onCreateRecords}
            loading={createLoading}
            disabled={disabled}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          >
            {t('ytScraper.createRevenueRecords')}
          </Button>
        </Col>
      </Row>
    </Card>
  );
};

export default CreateRevenueBar;
