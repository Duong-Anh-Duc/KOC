import { CloudDownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Space } from 'antd';
import { AppTooltip, NativeNumberInput } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle } from '../../types';

interface CycleFormModalProps {
  open: boolean;
  editingCycle: RevenueCycle | null;
  form: any;
  onCancel: () => void;
  onSubmit: (values: { month: string; exchange_rate: number }) => void;
  confirmLoading: boolean;
  onFetchExchangeRate: () => void;
  fetchExchangeRateLoading: boolean;
  onFetchExchangeRateSuccess: (rate: number) => void;
}

const CycleFormModal: React.FC<CycleFormModalProps> = ({
  open,
  editingCycle,
  form,
  onCancel,
  onSubmit,
  confirmLoading,
  onFetchExchangeRate,
  fetchExchangeRateLoading,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={editingCycle ? t('cycle.edit') : t('cycle.create')}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={confirmLoading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="month"
          label={t('cycle.month')}
          rules={[
            { required: true, message: t('validation.required') },
            { pattern: /^\d{2}\/\d{4}$/, message: t('common.formatMMYYYY') },
          ]}
        >
          <Input placeholder={t('cycle.monthPlaceholder')} disabled={!!editingCycle} />
        </Form.Item>
        <Form.Item label={t('revenue.exchangeRate') + ' (VND/USD)'} required>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="exchange_rate"
              noStyle
              rules={[{ required: true, message: t('validation.required') }]}
            >
              {/* AntD-original:
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/,/g, '') as unknown as 0}
                placeholder="25400"
              />
              */}
              <NativeNumberInput min={0} style={{ width: '100%' }} placeholder="25400" />
            </Form.Item>
            <AppTooltip title={t('cycle.fetchExchangeRate')}>
              <Button
                icon={fetchExchangeRateLoading ? <LoadingOutlined /> : <CloudDownloadOutlined />}
                loading={fetchExchangeRateLoading}
                onClick={onFetchExchangeRate}
              />
            </AppTooltip>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CycleFormModal;
