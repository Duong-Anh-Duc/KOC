import type { FormInstance } from 'antd';
import { Form, Input, InputNumber, Modal } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CycleFormModalProps {
  open: boolean;
  editing: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: { month: string; exchange_rate: number }) => void;
  confirmLoading: boolean;
}

const CycleFormModal: React.FC<CycleFormModalProps> = ({
  open,
  editing,
  form,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={editing ? t('cycle.edit') : t('cycle.create')}
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
          <Input placeholder={t('cycle.monthPlaceholder')} disabled={editing} />
        </Form.Item>
        <Form.Item
          name="exchange_rate"
          label={t('revenue.exchangeRate') + ' (VND/USD)'}
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
      </Form>
    </Modal>
  );
};

export default CycleFormModal;
