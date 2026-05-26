import { CameraOutlined, LoadingOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, Modal, Row, Upload } from 'antd';
import { appMessage as message } from '../../utils';
import { AppAvatar, AppTooltip, NativeBankSelect, NativeNumberInput, NativeSelect } from '../common';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';
import { uploadApi } from '../../api/upload.api';
// ⚡ Lightweight replacements for AntD (giảm tải máy yếu)
// AntD-original — backup nếu muốn revert sang Select với search:
// import { VIETNAM_BANK_SELECT_OPTIONS } from '../../constants/banks';
import type { CreateKOCInput, KOC } from '../../types';

interface KOCFormModalProps {
  open: boolean;
  editingKOC: KOC | null;
  cloningKOC?: KOC | null;
  onCancel: () => void;
  onSubmit: (values: CreateKOCInput, avatarFile?: File) => void;
  loading?: boolean;
}

const KOCFormModal: React.FC<KOCFormModalProps> = ({
  open,
  editingKOC,
  cloningKOC,
  onCancel,
  onSubmit,
  loading,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAvatarUrl(editingKOC?.avatar_url || null);
      setPendingAvatarFile(null);
      setPendingAvatarPreview(null);
    }
  }, [open, editingKOC]);

  const handleAvatarUpload = async (file: File) => {
    if (!editingKOC) {
      // During creation: store file and show local preview
      setPendingAvatarFile(file);
      setPendingAvatarPreview(URL.createObjectURL(file));
      return;
    }
    setUploading(true);
    try {
      const res = await uploadApi.uploadKocAvatar(editingKOC.id, file);
      if (res.data.success && res.data.data) {
        setAvatarUrl(res.data.data.avatar_url);
        message.success(t('upload.success'));
      }
    } catch {
      message.error(t('upload.error'));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (open && editingKOC) {
      form.setFieldsValue({
        ...editingKOC,
        base_rate: Number(editingKOC.base_rate),
        min_payment: Number(editingKOC.min_payment),
      });
    } else if (open && cloningKOC) {
      form.setFieldsValue({
        full_name: cloningKOC.full_name,
        channel_name: cloningKOC.channel_name,
        youtube_channel_id: cloningKOC.youtube_channel_id,
        email: cloningKOC.email,
        phone: cloningKOC.phone,
        bank_name: cloningKOC.bank_name,
        bank_account_number: cloningKOC.bank_account_number,
        tax_code: cloningKOC.tax_code,
        pub_code: cloningKOC.pub_code,
        base_rate: Number(cloningKOC.base_rate),
        min_payment: Number(cloningKOC.min_payment),
        status: cloningKOC.status,
      });
    } else if (open) {
      form.resetFields();
      form.setFieldValue('base_rate', 0.8);
      form.setFieldValue('min_payment', 100);
    }
  }, [open, editingKOC, cloningKOC, form]);

  const [fetchingPubCode, setFetchingPubCode] = useState(false);

  /** Extract channel ID from YouTube URL or raw input */
  const extractChannelId = (val: string): string => {
    const match = val.match(/(?:youtube\.com\/channel\/|studio\.youtube\.com\/channel\/)(UC[\w-]+)/i)
      || val.match(/(UC[\w-]{20,})/);
    return match ? match[1] : val.trim();
  };

  /** Auto-convert channel ID on blur */
  const handleChannelIdBlur = () => {
    const raw = form.getFieldValue('youtube_channel_id');
    if (raw) {
      const cleaned = extractChannelId(raw);
      if (cleaned !== raw) {
        form.setFieldValue('youtube_channel_id', cleaned);
      }
    }
  };

  /** Fetch pub code from YouTube Studio via GemLogin scraper */
  const handleFetchPubCode = async () => {
    const channelId = extractChannelId(form.getFieldValue('youtube_channel_id') || '');
    if (!channelId || !channelId.startsWith('UC')) {
      message.warning(t('koc.enterChannelIdFirst'));
      return;
    }
    setFetchingPubCode(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: { pub_code: string | null } }>(`/kocs/fetch-pub-code/${channelId}`);
      if (res.data.success && res.data.data.pub_code) {
        form.setFieldValue('pub_code', res.data.data.pub_code);
        message.success(`${t('koc.pubCodeFetched')}: ${res.data.data.pub_code}`);
      } else {
        message.warning(t('koc.pubCodeNotFound'));
      }
    } catch {
      message.error(t('koc.pubCodeFetchError'));
    } finally {
      setFetchingPubCode(false);
    }
  };

  const handleFinish = (values: CreateKOCInput) => {
    onSubmit(
      {
        ...values,
        youtube_channel_id: extractChannelId(values.youtube_channel_id),
        base_rate: Number(values.base_rate),
        min_payment: Number(values.min_payment),
      },
      !editingKOC && pendingAvatarFile ? pendingAvatarFile : undefined,
    );
  };

  return (
    <Modal
      title={
        editingKOC
          ? t('koc.edit')
          : cloningKOC
          ? `Nhân bản: ${cloningKOC.channel_name}`
          : t('koc.create')
      }
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width="min(720px, 100vw - 32px)"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        {/* Avatar upload */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Upload
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
              handleAvatarUpload(file);
              return false;
            }}
          >
            <div style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
              {/* AntD-original: <Avatar size={80} src={...} icon={...} /> */}
              <AppAvatar
                size={80}
                src={editingKOC ? avatarUrl : pendingAvatarPreview}
                icon={!(editingKOC ? avatarUrl : pendingAvatarPreview) ? <UserOutlined /> : undefined}
                style={{ backgroundColor: (editingKOC ? avatarUrl : pendingAvatarPreview) ? undefined : '#ED8F3A' }}
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
          {uploading && <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>{t('upload.uploading')}</div>}
          {!editingKOC && pendingAvatarPreview && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>{t('upload.willUploadAfterCreate') || 'Ảnh sẽ được tải lên sau khi tạo KOC'}</div>
          )}
        </div>

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
              extra={t('koc.channelIdHint')}
            >
              <Input
                placeholder="UCxxxxxxx hoặc https://studio.youtube.com/channel/UCxxxxxxx"
                onBlur={handleChannelIdBlur}
              />
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
              {/* ⚡ Native <select> — nhẹ hơn AntD Select, OS render dropdown */}
              <NativeBankSelect placeholder={t('koc.bankNamePlaceholder')} />
              {/* AntD-original — uncomment + xoá NativeBankSelect ở trên để revert:
              <Select
                showSearch
                allowClear
                placeholder={t('koc.bankNamePlaceholder')}
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={VIETNAM_BANK_SELECT_OPTIONS}
              />
              */}
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
            >
              {/* AntD-original:
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                style={{ width: '100%' }}
                formatter={(value) => `${(Number(value) * 100).toFixed(0)}%`}
                parser={(value) => (parseFloat(value?.replace('%', '') || '80') / 100) as 0}
              />
              */}
              <NativeNumberInput min={0} max={1} step={0.05} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="min_payment"
              label={t('koc.minPayment')}
              extra={t('koc.minPaymentHint')}
              rules={[
                { type: 'number', min: 0, message: t('validation.required') },
              ]}
            >
              {/* AntD-original:
              <InputNumber
                min={0}
                step={10}
                precision={0}
                style={{ width: '100%' }}
                addonBefore="$"
              />
              */}
              <NativeNumberInput min={0} step={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={editingKOC ? 12 : 24}>
            <Form.Item
              name="pub_code"
              label={
                <span>
                  {t('koc.pubCode')}
                  <AppTooltip title={t('koc.fetchPubCodeTooltip')}>
                    <Button
                      type="link"
                      size="small"
                      icon={fetchingPubCode ? <LoadingOutlined /> : <SearchOutlined />}
                      onClick={handleFetchPubCode}
                      loading={fetchingPubCode}
                      style={{ marginLeft: 6, padding: 0, height: 'auto' }}
                    >
                      {t('koc.fetchPubCode')}
                    </Button>
                  </AppTooltip>
                </span>
              }
              extra={t('koc.pubCodeHint')}
            >
              <Input placeholder="pub-1234567890" />
            </Form.Item>
          </Col>
          {editingKOC && (
            <Col span={12}>
              <Form.Item name="status" label={t('koc.status')}>
                {/* AntD-original:
                <Select>
                  <Select.Option value="ACTIVE">{t('status.active')}</Select.Option>
                  <Select.Option value="INACTIVE">{t('status.inactive')}</Select.Option>
                </Select>
                */}
                <NativeSelect
                  options={[
                    { value: 'ACTIVE', label: t('status.active') },
                    { value: 'INACTIVE', label: t('status.inactive') },
                  ]}
                />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  );
};

export default KOCFormModal;
