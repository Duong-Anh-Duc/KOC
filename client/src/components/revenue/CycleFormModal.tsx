import { CloudDownloadOutlined } from '@ant-design/icons';
import { Button, Form, Input, InputNumber, Modal, Space, Tooltip } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueCycle } from '../../types';

/**
 * Calculate the next month in MM/YYYY format from the latest cycle.
 * e.g. if latest is "01/2026" → "02/2026"; "12/2025" → "01/2026"
 */
function getNextMonth(cycles: RevenueCycle[]): string | undefined {
  if (!cycles || cycles.length === 0) return undefined;

  // Find latest month by sorting MM/YYYY strings
  const sorted = [...cycles].sort((a, b) => {
    const [ma, ya] = a.month.split('/').map(Number);
    const [mb, yb] = b.month.split('/').map(Number);
    if (ya !== yb) return yb - ya;
    return mb - ma;
  });

  const latest = sorted[0]?.month;
  if (!latest || !/^\d{2}\/\d{4}$/.test(latest)) return undefined;

  const [mm, yyyy] = latest.split('/').map(Number);
  const nextMonth = mm === 12 ? 1 : mm + 1;
  const nextYear = mm === 12 ? yyyy + 1 : yyyy;
  return `${String(nextMonth).padStart(2, '0')}/${nextYear}`;
}

interface CycleFormModalProps {
  open: boolean;
  editingCycle: RevenueCycle | null;
  form: any;
  cycles: RevenueCycle[];
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
  cycles,
  onCancel,
  onSubmit,
  confirmLoading,
  onFetchExchangeRate,
  fetchExchangeRateLoading,
}) => {
  const { t } = useTranslation();

  // Auto-fill next month when creating a new cycle
  useEffect(() => {
    if (open && !editingCycle) {
      const nextMonth = getNextMonth(cycles);
      if (nextMonth) {
        form.setFieldsValue({ month: nextMonth });
      }
    }
  }, [open, editingCycle, cycles, form]);

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
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/,/g, '') as unknown as 0}
                placeholder="25400"
              />
            </Form.Item>
            <Tooltip title={t('cycle.fetchExchangeRate')}>
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={onFetchExchangeRate}
              />
            </Tooltip>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CycleFormModal;
