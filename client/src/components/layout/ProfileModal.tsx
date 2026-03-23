import { CameraOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Avatar, Form, Input, Modal, Tag, Upload } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api';
import { uploadApi } from '../../api/upload.api';
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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({ full_name: user.full_name, email: user.email });
    }
  }, [open, user, form]);

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadApi.uploadUserAvatar(file);
      if (res.data.success && res.data.data) {
        updateUser({ avatar_url: res.data.data.avatar_url });
        toastSuccess('avatarUpdated', t('profile.updateSuccess'));
      }
    } catch {
      toastError('avatarError', t('profile.updateError'));
    } finally {
      setUploading(false);
    }
  };

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
        <Upload
          showUploadList={false}
          accept="image/*"
          beforeUpload={(file) => {
            handleAvatarUpload(file);
            return false;
          }}
        >
          <div style={{ cursor: 'pointer', position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            <Avatar
              size={80}
              src={user?.avatar_url}
              icon={!user?.avatar_url ? <UserOutlined /> : undefined}
              style={{ backgroundColor: user?.avatar_url ? undefined : '#ED8F3A' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                background: '#1677ff',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
              }}
            >
              <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
          </div>
        </Upload>
        {uploading && <div style={{ fontSize: 12, color: '#888' }}>{t('common.loading')}</div>}
        <div>
          <Tag color={user?.role === 'ADMIN' ? 'red' : user?.role === 'KOC' ? 'green' : user?.role === 'VIEWER' ? 'orange' : 'blue'}>
            {user?.role}
          </Tag>
        </div>
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
