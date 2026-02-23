import { LockOutlined, MailOutlined, UserAddOutlined } from '@ant-design/icons';
import { Form, Input, Modal, Typography } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface CreateKocAccountModalProps {
  open: boolean;
  kocName: string;
  kocEmail: string;
  loading: boolean;
  onSubmit: (values: { email: string; password: string }) => void;
  onCancel: () => void;
}

const CreateKocAccountModal: React.FC<CreateKocAccountModalProps> = ({
  open,
  kocName,
  kocEmail,
  loading,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ email: kocEmail, password: '' });
    }
  }, [open, kocEmail, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSubmit(values);
    });
  };

  return (
    <Modal
      title={
        <span>
          <UserAddOutlined style={{ marginRight: 8 }} />
          {t('kocAccount.createTitle')}
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={t('kocAccount.createButton')}
      cancelText={t('common.cancel')}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('kocAccount.createDesc', { name: kocName })}
        </Text>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          name="email"
          label={t('auth.email')}
          rules={[
            { required: true, message: t('auth.emailRequired') },
            { type: 'email', message: t('auth.emailInvalid') },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder={t('auth.emailPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="password"
          label={t('auth.password')}
          rules={[
            { required: true, message: t('auth.passwordRequired') },
            { min: 6, message: t('kocAccount.passwordMin') },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder={t('auth.passwordPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateKocAccountModal;
