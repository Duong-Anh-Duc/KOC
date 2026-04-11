import { Col, Form, InputNumber, Modal, Row, Select } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RevenueRecord } from '../../types';

interface RevenueRecordModalProps {
  open: boolean;
  editingRecord: RevenueRecord | null;
  activeKOCs: Array<{ id: string; full_name: string; channel_name: string }>;
  cycleId: number;
  onCancel: () => void;
  onSubmit: (values: { koc_id: string; original_revenue_usd: number; us_tax_deduction: number }) => void;
  loading?: boolean;
}

const RevenueRecordModal: React.FC<RevenueRecordModalProps> = ({
  open,
  editingRecord,
  activeKOCs,
  cycleId,
  onCancel,
  onSubmit,
  loading,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (open && editingRecord) {
      form.setFieldsValue({
        koc_id: editingRecord.koc_id,
        original_revenue_usd: Number(editingRecord.original_revenue_usd),
        us_tax_deduction: Number(editingRecord.us_tax_deduction),
      });
    } else if (open) {
      form.resetFields();
    }
  }, [open, editingRecord, form]);

  return (
    <Modal
      title={editingRecord ? t('revenue.editRecord') : t('revenue.createRecord')}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width="min(520px, 100vw - 32px)"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onSubmit({ ...values, cycle_id: cycleId })}
      >
        <Form.Item
          name="koc_id"
          label={t('revenue.selectKOC')}
          rules={[{ required: true, message: t('validation.required') }]}
        >
          <Select
            showSearch
            placeholder={t('revenue.selectKOCPlaceholder')}
            disabled={!!editingRecord}
            optionFilterProp="label"
            options={activeKOCs.map((koc) => ({
              value: koc.id,
              label: `${koc.full_name} (${koc.channel_name})`,
            }))}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="original_revenue_usd"
              label={t('revenue.originalRevenue') + ' ($)'}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as 0}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="us_tax_deduction"
              label={t('revenue.usTax') + ' ($)'}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as 0}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default RevenueRecordModal;
