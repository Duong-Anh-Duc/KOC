import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Form,
  Grid,
  Input,
  message,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi, type StaffUser } from '../api/auth.api';
import UserFormModal from '../components/user/UserFormModal';
import UserStatsCards from '../components/user/UserStatsCards';
import { useAuthStore } from '../stores';

const { useBreakpoint } = Grid;

const { Title, Text: AntText } = Typography;
const { Search } = Input;

const ROLE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  ADMIN:      { bg: '#fff1f0', color: '#cf1322', border: '#ffa39e' },
  ACCOUNTANT: { bg: '#e6f4ff', color: '#0958d9', border: '#91caff' },
  VIEWER:     { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
};

const DEFAULT_PAGE_SIZE = 20;

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [users, setUsers]           = useState<StaffUser[]>([]);
  const [total, setTotal]           = useState(0);
  const [stats, setStats]           = useState<{ activeCount: number; accountantCount: number; viewerCount: number }>({ activeCount: 0, accountantCount: 0, viewerCount: 0 });
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<StaffUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async (page = currentPage, q = search) => {
    try {
      setLoading(true);
      const res = await authApi.listUsers({ page, limit: pageSize, search: q || undefined });
      if (res.data.success && res.data.data) {
        setUsers(res.data.data.data ?? []);
        setTotal(res.data.data.total ?? 0);
        if (res.data.data.stats) setStats(res.data.data.stats);
      }
    } catch {
      message.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => { fetchUsers(currentPage, search); }, [currentPage, search]);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit   = (user: StaffUser) => { setEditing(user); form.setFieldsValue({ full_name: user.full_name, email: user.email, role: user.role }); setModalOpen(true); };

  const handleSubmit = async (values: { full_name: string; email: string; password?: string; role: string }) => {
    setSubmitting(true);
    try {
      if (editing) {
        await authApi.updateUser(editing.id, { full_name: values.full_name, email: values.email, role: values.role });
        message.success(t('users.updateSuccess'));
      } else {
        await authApi.register({ full_name: values.full_name, email: values.email, password: values.password!, role: values.role });
        message.success(t('users.createSuccess'));
      }
      setModalOpen(false);
      fetchUsers(currentPage, search);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: StaffUser, is_active: boolean) => {
    try {
      await authApi.toggleUserActive(user.id, is_active);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active } : u));
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await authApi.deleteUser(id);
      message.success(t('users.deleteSuccess'));
      const newPage = users.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(newPage);
      fetchUsers(newPage, search);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error');
    }
  };

  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };

  const columns: ColumnsType<StaffUser> = [
    {
      title: 'STT',
      key: 'stt',
      width: 56,
      align: 'center' as const,
      render: (_: unknown, __: StaffUser, index: number) => (
        <AntText type="secondary" style={{ fontSize: 13 }}>{(currentPage - 1) * pageSize + index + 1}</AntText>
      ),
    },
    {
      title: t('users.name'),
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string, record: StaffUser) => (
        <Space size={12}>
          <Avatar
            icon={<UserOutlined />}
            style={{ background: 'linear-gradient(135deg, #ED8F3A, #f5a962)', flexShrink: 0 }}
            size={38}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: '20px' }}>{name}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: '18px' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: t('users.role'),
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role: string) => {
        const s = ROLE_STYLE[role] ?? { bg: '#f5f5f5', color: '#595959', border: '#d9d9d9' };
        const label = role === 'ADMIN' ? t('users.roleAdmin')
          : role === 'ACCOUNTANT' ? t('users.roleAccountant')
          : role === 'VIEWER' ? t('users.roleViewer')
          : role;
        return (
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            {label}
          </span>
        );
      },
    },
    {
      title: t('users.active'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 130,
      responsive: ['md'] as any,
      render: (active: boolean, record: StaffUser) => (
        <Tooltip title={record.role === 'ADMIN' ? 'Không thể thay đổi trạng thái Admin' : (active ? 'Nhấn để vô hiệu hóa' : 'Nhấn để kích hoạt')}>
          <Switch
            checked={active}
            size="small"
            disabled={record.role === 'ADMIN'}
            onChange={(val) => handleToggleActive(record, val)}
            style={active ? { background: '#52c41a' } : undefined}
          />
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: active ? '#52c41a' : '#ff4d4f' }}>
            {active ? t('users.active') : t('users.inactive')}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('users.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 155,
      responsive: ['lg'] as any,
      render: (d: string) => (
        <AntText type="secondary" style={{ fontSize: 13 }}>
          {new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </AntText>
      ),
    },
    {
      title: t('users.actions'),
      key: 'actions',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: StaffUser) => {
        const isSelf = record.id === currentUser?.userId;
        const isAdmin = record.role === 'ADMIN';
        if (isSelf || isAdmin) {
          return <AntText type="secondary" style={{ fontSize: 12 }}>{isSelf ? 'Bạn' : '—'}</AntText>;
        }
        return (
          <Space size={6}>
            <Tooltip title="Chỉnh sửa" placement="top" color="#ED8F3A">
              <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} style={{ border: '1px solid #ED8F3A', color: '#ED8F3A', borderRadius: 6 }} />
            </Tooltip>
            <Tooltip title="Xóa tài khoản" placement="top" color="#ff4d4f">
              <Popconfirm
                title="Xóa người dùng này?"
                description="Hành động này không thể hoàn tác."
                onConfirm={() => handleDelete(record.id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                placement="topRight"
              >
                <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>{t('users.title')}</Title>
          {!isMobile && <AntText type="secondary" style={{ fontSize: 13 }}>Quản lý tài khoản kế toán và người xem trong hệ thống</AntText>}
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          size="middle"
          style={{ background: 'linear-gradient(135deg, #ED8F3A, #f5a962)', border: 'none', borderRadius: 8, fontWeight: 600, height: 38, paddingInline: 18, boxShadow: '0 2px 8px rgba(237,143,58,0.35)', alignSelf: isMobile ? 'flex-end' : undefined }}
        >
          {t('users.createUser')}
        </Button>
      </div>

      <UserStatsCards total={total} {...stats} />

      <Search
        placeholder={t('users.searchPlaceholder')}
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 340, marginBottom: 14, borderRadius: 8 }}
      />

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize,
          total,
          onChange: (page) => setCurrentPage(page),
          onShowSizeChange: (_, size) => { setPageSize(size); setCurrentPage(1); },
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `${t('common.total')}: ${total}`,
        }}
        size="middle"
        scroll={{ x: isMobile ? 'max-content' : undefined }}
        style={{ borderRadius: 10, overflow: 'hidden' }}
        rowClassName={() => 'um-row'}
      />

      <UserFormModal
        open={modalOpen}
        editing={editing}
        submitting={submitting}
        form={form}
        onClose={() => setModalOpen(false)}
        onFinish={handleSubmit}
      />

      <style>{`
        .um-row:hover td { background: #fffbf5 !important; }
        .um-row td { transition: background 0.15s; }
      `}</style>
    </div>
  );
};

export default UserManagementPage;
