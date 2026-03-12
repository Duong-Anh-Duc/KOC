import { useMutation } from '@tanstack/react-query';
import { Form, Input, Modal } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api';
import { toastError, toastSuccess } from '../../utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      toastSuccess('passwordChanged', t('profile.passwordChangeSuccess'));
      form.resetFields();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || t('profile.passwordChangeError');
      toastError('passwordError', msg);
    },
  });

  const handleOk = () => {
    form.validateFields().then((values) => {
      mutation.mutate({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={t('profile.changePassword')}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText={t('profile.changePasswordBtn')}
      cancelText={t('common.cancel')}
      confirmLoading={mutation.isPending}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="currentPassword"
          label={t('profile.currentPassword')}
          rules={[{ required: true, message: t('profile.currentPasswordRequired') }]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t('profile.newPassword')}
          rules={[
            { required: true, message: t('profile.newPasswordRequired') },
            { min: 6, message: t('profile.passwordMinLength') },
          ]}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t('profile.confirmPassword')}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: t('profile.confirmPasswordRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error(t('profile.passwordMismatch')));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
