import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Space } from 'antd';
import type { FormInstance } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StaffUser } from '../../api/auth.api';

const ROLE_OPTIONS = [
  { value: 'ACCOUNTANT', labelKey: 'users.roleAccountant', color: '#1677ff' },
  { value: 'VIEWER',     labelKey: 'users.roleViewer',     color: '#ED8F3A' },
];

interface Props {
  open: boolean;
  editing: StaffUser | null;
  submitting: boolean;
  form: FormInstance<any>;
  onClose: () => void;
  onFinish: (values: { full_name: string; email: string; password?: string; role: string }) => void;
}

const UserFormModal: React.FC<Props> = ({ open, editing, submitting, form, onClose, onFinish }) => {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <UserOutlined style={{ color: '#ED8F3A' }} />
          <span>{editing ? t('users.editUser') : t('users.createUser')}</span>
        </Space>
      }
      footer={null}
      destroyOnClose
      width={480}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
        <Form.Item
          name="full_name"
          label={t('users.name')}
          rules={[{ required: true, message: t('users.namePlaceholder') }]}
        >
          <Input
            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
            placeholder={t('users.namePlaceholder')}
            size="large"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="email"
          label={t('auth.email')}
          rules={[
            { required: true, message: t('auth.emailRequired') },
            { type: 'email', message: t('auth.emailInvalid') },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
            placeholder={t('auth.emailPlaceholder')}
            size="large"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        {!editing && (
          <Form.Item
            name="password"
            label={t('users.initialPassword')}
            rules={[
              { required: true, message: t('users.passwordPlaceholder') },
              { min: 6, message: t('auth.passwordTooShort') },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder={t('users.passwordPlaceholder')}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        )}

        <Form.Item
          name="role"
          label={t('users.role')}
          initialValue="ACCOUNTANT"
          rules={[{ required: true }]}
        >
          <Select size="large" style={{ borderRadius: 8 }}>
            {ROLE_OPTIONS.map((r) => (
              <Select.Option key={r.value} value={r.value}>
                <Space>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8,
                    borderRadius: '50%', background: r.color,
                  }} />
                  {t(r.labelKey)}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>Hủy</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            style={{
              background: 'linear-gradient(135deg, #ED8F3A, #f5a962)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            {editing ? 'Lưu thay đổi' : t('users.createUser')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default UserFormModal;
