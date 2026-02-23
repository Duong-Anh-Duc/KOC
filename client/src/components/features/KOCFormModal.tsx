import { Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateKOCInput, KOC } from '../../types';

interface KOCFormModalProps {
  open: boolean;
  editingKOC: KOC | null;
  onCancel: () => void;
  onSubmit: (values: CreateKOCInput) => void;
  loading?: boolean;
}

const KOCFormModal: React.FC<KOCFormModalProps> = ({
  open,
  editingKOC,
  onCancel,
  onSubmit,
  loading,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && editingKOC) {
      form.setFieldsValue({
        ...editingKOC,
        base_rate: Number(editingKOC.base_rate),
      });
    } else if (open) {
      form.resetFields();
      form.setFieldValue('base_rate', 0.8);
    }
  }, [open, editingKOC, form]);

  const handleFinish = (values: CreateKOCInput) => {
    onSubmit(values);
  };

  return (
    <Modal
        title={editingKOC ? t('koc.edit') : t('koc.create')}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="full_name"
              label={t('koc.fullName')}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <Input placeholder={t('koc.fullNamePlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="channel_name"
              label={t('koc.channelName')}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <Input placeholder={t('koc.channelNamePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="youtube_channel_id"
              label={t('koc.youtubeChannelId')}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <Input placeholder={t('koc.channelIdShortPlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label={t('koc.email')}
              rules={[
                { required: true, message: t('validation.required') },
                { type: 'email', message: t('validation.invalidEmail') },
              ]}
            >
              <Input placeholder={t('koc.emailExamplePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="phone"
              label={t('koc.phone')}
            >
              <Input placeholder="0901234567" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="tax_code"
              label={t('koc.taxCode')}
            >
              <Input placeholder={t('koc.taxCodePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="bank_name"
              label={t('koc.bankName')}
            >
              <Input placeholder={t('koc.bankNamePlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="bank_account_number"
              label={t('koc.bankAccount')}
            >
              <Input placeholder="1234567890" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="base_rate"
              label={t('koc.baseRate')}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                style={{ width: '100%' }}
                formatter={(value) => `${(Number(value) * 100).toFixed(0)}%`}
                parser={(value) => (parseFloat(value?.replace('%', '') || '80') / 100) as 0}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="pub_code"
              label={t('koc.pubCode')}
              extra={t('koc.pubCodeHint')}
            >
              <Input placeholder={t('koc.pubCodePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          {editingKOC && (
            <Col span={12}>
              <Form.Item name="status" label={t('koc.status')}>
                <Select>
                  <Select.Option value="ACTIVE">{t('status.active')}</Select.Option>
                  <Select.Option value="INACTIVE">{t('status.inactive')}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  );
};

export default KOCFormModal;
