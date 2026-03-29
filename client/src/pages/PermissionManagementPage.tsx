import { SafetyOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Empty, message, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  permissionApi,
  type KocAccessEntry,
  type KocItem,
  type KocPermDef,
  type ManagerUser,
} from '../api/permission.api';
import KocAccessModal from '../components/permission/KocAccessModal';
import PermissionDetailModal from '../components/permission/PermissionDetailModal';

const { Title, Text } = Typography;

const PermissionManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState<string | null>(null);
  const [managers, setManagers]     = useState<ManagerUser[]>([]);
  const [kocs, setKocs]             = useState<KocItem[]>([]);
  const [accessMap, setAccessMap]   = useState<Record<string, KocAccessEntry[]>>({});
  const [kocPermDefs, setKocPermDefs] = useState<KocPermDef[]>([]);
  const [selectedManager, setSelectedManager] = useState<ManagerUser | null>(null);
  const [permModalKoc, setPermModalKoc]       = useState<KocItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await permissionApi.getPermissions();
      if (res.data.success && res.data.data) {
        setManagers(res.data.data.managers || []);
        setKocs(res.data.data.kocs || []);
        setAccessMap(res.data.data.managerKocAccess || {});
        setKocPermDefs(res.data.data.kocPermissionDefinitions || []);
      }
    } catch {
      message.error(t('permissions.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getKocAccess = (managerId: string, kocId: string): KocAccessEntry | undefined =>
    (accessMap[managerId] || []).find((e) => e.koc_id === kocId);

  const handleKocToggle = async (managerId: string, kocId: string, enabled: boolean) => {
    setSaving(`toggle-${kocId}`);
    setAccessMap((prev) => {
      const list = [...(prev[managerId] || [])];
      if (enabled) {
        if (!list.find((e) => e.koc_id === kocId)) {
          list.push({ koc_id: kocId, permissions: kocPermDefs.filter((d) => d.key.startsWith('view_')).map((d) => d.key) });
        }
      } else {
        const idx = list.findIndex((e) => e.koc_id === kocId);
        if (idx >= 0) list.splice(idx, 1);
      }
      return { ...prev, [managerId]: list };
    });
    try {
      await permissionApi.toggleKocAccess(managerId, kocId, enabled);
    } catch {
      message.error(t('permissions.updateError'));
      fetchData();
    } finally {
      setSaving(null);
    }
  };

  const handlePermToggle = async (managerId: string, kocId: string, permKey: string, checked: boolean) => {
    const entry = getKocAccess(managerId, kocId);
    if (!entry) return;
    const updated = checked ? [...entry.permissions, permKey] : entry.permissions.filter((p) => p !== permKey);
    setSaving(`perm-${kocId}-${permKey}`);
    setAccessMap((prev) => {
      const list = (prev[managerId] || []).map((e) => e.koc_id === kocId ? { ...e, permissions: updated } : e);
      return { ...prev, [managerId]: list };
    });
    try {
      await permissionApi.updateKocPermissions(managerId, kocId, updated);
    } catch {
      message.error(t('permissions.updateError'));
      fetchData();
    } finally {
      setSaving(null);
    }
  };

  const handleSelectAll = async (managerId: string, selectAll: boolean) => {
    setSaving('bulk');
    try {
      await permissionApi.bulkToggle(managerId, kocs.map((k) => k.id), selectAll);
      await fetchData();
    } catch {
      message.error(t('permissions.updateError'));
    } finally {
      setSaving(null);
    }
  };

  const managerColumns: ColumnsType<ManagerUser> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_: unknown, __: ManagerUser, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: t('permissions.colManager'),
      key: 'name',
      render: (_: unknown, record: ManagerUser) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
          <div>
            <Text strong>{record.full_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: t('permissions.colKocAccess'),
      key: 'access',
      width: 180,
      align: 'center',
      render: (_: unknown, record: ManagerUser) => {
        const count = (accessMap[record.id] || []).length;
        return <Tag color={count > 0 ? 'blue' : 'default'}>{count} / {kocs.length} KOC</Tag>;
      },
    },
    {
      title: t('permissions.colAction'),
      key: 'action',
      width: 80,
      align: 'center',
      render: (_: unknown, record: ManagerUser) => (
        <Tooltip title={t('permissions.configure')}>
          <Button type="primary" shape="circle" icon={<SettingOutlined />} onClick={() => setSelectedManager(record)} />
        </Tooltip>
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  }

  const modalEntry = selectedManager && permModalKoc
    ? getKocAccess(selectedManager.id, permModalKoc.id) ?? null
    : null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SafetyOutlined style={{ marginRight: 8 }} />
          {t('permissions.title')}
        </Title>
        <Text type="secondary">{t('permissions.description')}</Text>
      </div>

      {managers.length === 0 ? (
        <Empty description={t('permissions.noManagers')} />
      ) : (
        <Table
          columns={managerColumns}
          dataSource={managers}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
          }}
          size="middle"
        />
      )}

      <KocAccessModal
        manager={selectedManager}
        kocs={kocs}
        accessMap={accessMap}
        kocPermDefs={kocPermDefs}
        saving={saving}
        onClose={() => setSelectedManager(null)}
        onKocToggle={handleKocToggle}
        onSelectAll={handleSelectAll}
        onOpenDetail={(koc) => setPermModalKoc(koc)}
      />

      <PermissionDetailModal
        manager={selectedManager}
        koc={permModalKoc}
        entry={modalEntry}
        kocPermDefs={kocPermDefs}
        saving={saving}
        onClose={() => setPermModalKoc(null)}
        onPermToggle={handlePermToggle}
      />
    </div>
  );
};

export default PermissionManagementPage;
