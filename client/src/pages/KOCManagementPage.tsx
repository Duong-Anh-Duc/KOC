import { TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const { useBreakpoint } = Grid;
import { kocAccountApi } from '../api';
import apiClient from '../api/client';
import { uploadApi } from '../api/upload.api';
import { SummaryBar } from '../components/common';
import { KOCFormModal } from '../components/features';
import { CreateKocAccountModal, KOCHeader, KOCTable } from '../components/kocManagement';
import { useCreateKOC, useDeleteKOC, useKOCs, useUpdateKOC } from '../hooks';
import { useAuthStore } from '../stores';
import type { CreateKOCInput, KOC, UpdateKOCInput } from '../types';
import { toastError, toastSuccess } from '../utils';

const KOCManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const isViewer = user?.role === 'VIEWER';
  const queryClient = useQueryClient();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKOC, setEditingKOC] = useState<KOC | null>(null);
  const [cloningKOC, setCloningKOC] = useState<KOC | null>(null);

  // Account creation state
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountTargetKOC, setAccountTargetKOC] = useState<KOC | null>(null);

  const { data, isLoading, refetch } = useKOCs({ page, limit: pageSize, search });
  const createMutation = useCreateKOC();
  const updateMutation = useUpdateKOC();
  const deleteMutation = useDeleteKOC();

  // Query to check which KOCs already have accounts
  const { data: accountsData } = useQuery({
    queryKey: ['koc-accounts'],
    queryFn: () => apiClient.get<{ success: boolean; data: Record<string, boolean> }>('/kocs/accounts-status').then((res) => res.data.data),
    enabled: isAdmin,
  });
  const kocHasAccount = accountsData || {};

  const createAccountMutation = useMutation({
    mutationFn: ({ kocId, data }: { kocId: string; data: { email: string; password: string } }) =>
      kocAccountApi.createAccount(kocId, data),
    onSuccess: () => {
      toastSuccess('kocAccountCreateSuccess');
      setAccountModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['koc-accounts'] });
    },
    onError: () => {
      toastError('kocAccountCreateError');
    },
  });

  const kocs = data?.data || [];
  const meta = data?.meta;

  const filteredKocs = kocs.filter((koc) => {
    if (statusFilter && koc.status !== statusFilter) return false;
    return true;
  });

  const handleCreate = () => {
    setEditingKOC(null);
    setModalOpen(true);
  };

  const handleEdit = (koc: KOC) => {
    setCloningKOC(null);
    setEditingKOC(koc);
    setModalOpen(true);
  };

  const handleDuplicate = (koc: KOC) => {
    setEditingKOC(null);
    setCloningKOC(koc);
    setModalOpen(true);
  };

  const handleSubmit = (values: CreateKOCInput, avatarFile?: File) => {
    if (editingKOC) {
      updateMutation.mutate(
        { id: editingKOC.id, data: values as UpdateKOCInput },
        {
          onSuccess: () => {
            setModalOpen(false);
            setEditingKOC(null);
            refetch();
          }
        }
      );
    } else {
      createMutation.mutate(values, {
        onSuccess: (response) => {
          const newKoc = (response as any)?.data?.data;
          if (avatarFile && newKoc?.id) {
            uploadApi.uploadKocAvatar(newKoc.id, avatarFile).then(() => refetch()).catch(() => {});
          }
          setModalOpen(false);
          setCloningKOC(null);
        }
      });
    }
  };

  const handleCreateAccount = (koc: KOC) => {
    setAccountTargetKOC(koc);
    setAccountModalOpen(true);
  };

  const handleAccountSubmit = (values: { email: string; password: string }) => {
    if (!accountTargetKOC) return;
    createAccountMutation.mutate({ kocId: accountTargetKOC.id, data: values });
  };

  return (
    <div style={{ padding: isMobile ? '0 4px' : undefined }}>
      <KOCHeader
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setPage(1); refetch(); }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => { setStatusFilter(val); setPage(1); }}
        onRefresh={() => refetch()}
        isAdmin={isAdmin}
        onCreate={handleCreate}
      />

      <SummaryBar
        items={[
          {
            title: t('dashboard.totalKOCs'),
            value: meta?.total || 0,
            prefix: <TeamOutlined />,
            valueStyle: { color: '#1677ff' },
          },
          {
            title: t('dashboard.activeKOCs'),
            value: (meta as any)?.activeCount || 0,
            prefix: <UserAddOutlined />,
            valueStyle: { color: '#52c41a' },
          },
          {
            title: t('dashboard.inactiveKOCs'),
            value: (meta as any)?.inactiveCount || 0,
            valueStyle: { color: '#faad14' },
          },
        ]}
        loading={isLoading}
      />

      <KOCTable
        kocs={filteredKocs}
        loading={isLoading}
        isAdmin={isAdmin}
        page={page}
        pageSize={pageSize}
        total={meta?.total || 0}
        statusFilter={statusFilter}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={(id) => deleteMutation.mutate(id)}
        onCreateAccount={isAdmin ? handleCreateAccount : undefined}
        kocHasAccount={kocHasAccount}
      />

      <KOCFormModal
        open={modalOpen}
        editingKOC={editingKOC}
        cloningKOC={cloningKOC}
        onCancel={() => { setModalOpen(false); setCloningKOC(null); }}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <CreateKocAccountModal
        open={accountModalOpen}
        kocName={accountTargetKOC?.full_name || ''}
        kocEmail={accountTargetKOC?.email || ''}
        loading={createAccountMutation.isPending}
        onSubmit={handleAccountSubmit}
        onCancel={() => setAccountModalOpen(false)}
      />
    </div>
  );
};

export default KOCManagementPage;
