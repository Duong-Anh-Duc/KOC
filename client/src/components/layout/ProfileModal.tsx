import { useMutation } from '@tanstack/react-query';
import { Form, Input, Modal, Tag } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores';
import { toastError, toastSuccess } from '../../utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({ full_name: user.full_name, email: user.email });
    }
  }, [open, user, form]);

  const mutation = useMutation({
    mutationFn: (data: { full_name?: string; email?: string }) => authApi.updateProfile(data),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data) {
        updateUser({ full_name: data.full_name, email: data.email });
      }
      toastSuccess('profileUpdated', t('profile.updateSuccess'));
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || t('profile.updateError');
      toastError('profileError', msg);
    },
  });

  const handleOk = () => {
    form.validateFields().then((values) => {
      mutation.mutate(values);
    });
  };

  return (
    <Modal
      title={t('profile.title')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={mutation.isPending}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Tag color={user?.role === 'ADMIN' ? 'red' : user?.role === 'KOC' ? 'green' : 'blue'}>
          {user?.role}
        </Tag>
      </div>
      <Form form={form} layout="vertical">
        <Form.Item
          name="full_name"
          label={t('profile.fullName')}
          rules={[{ required: true, message: t('profile.fullNameRequired') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('profile.email')}
          rules={[
            { required: true, message: t('profile.emailRequired') },
            { type: 'email', message: t('profile.emailInvalid') },
          ]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProfileModal;
