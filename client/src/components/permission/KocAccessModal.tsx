import { SettingOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import {  AppSpin, AppTooltip, AppTag } from '../common';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KocAccessEntry, KocItem, KocPermDef, ManagerUser } from '../../api/permission.api';

const { Search } = Input;
const { Text: AntText } = Typography;

interface Props {
  manager: ManagerUser | null;
  kocs: KocItem[];
  accessMap: Record<string, KocAccessEntry[]>;
  kocPermDefs: KocPermDef[];
  saving: string | null;
  onClose: () => void;
  onKocToggle: (managerId: string, kocId: string, enabled: boolean) => void;
  onSelectAll: (managerId: string, selectAll: boolean) => void;
  onOpenDetail: (koc: KocItem) => void;
}

const KocAccessModal: React.FC<Props> = ({
  manager, kocs, accessMap, kocPermDefs, saving,
  onClose, onKocToggle, onSelectAll, onOpenDetail,
}) => {
  const { t } = useTranslation();
  const [kocSearch, setKocSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredKocs = useMemo(() => {
    if (!kocSearch.trim()) return kocs;
    const q = kocSearch.toLowerCase();
    return kocs.filter(
      (k) => k.full_name.toLowerCase().includes(q) || k.channel_name.toLowerCase().includes(q)
    );
  }, [kocs, kocSearch]);

  const isKocEnabled = (managerId: string, kocId: string) =>
    !!(accessMap[managerId] || []).find((e) => e.koc_id === kocId);

  const getKocAccess = (managerId: string, kocId: string) =>
    (accessMap[managerId] || []).find((e) => e.koc_id === kocId);

  const allSelected = manager
    ? (accessMap[manager.id] || []).length === kocs.length && kocs.length > 0
    : false;

  const kocColumns: ColumnsType<KocItem> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_: unknown, __: KocItem, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: t('permissions.colKocName'),
      key: 'name',
      render: (_: unknown, record: KocItem) => (
        <div>
          <AntText strong>{record.full_name}</AntText>
          <br />
          <AntText type="secondary" style={{ fontSize: 12 }}>
            {record.channel_name}
            {record.admin?.full_name && <span> &middot; Admin: {record.admin.full_name}</span>}
          </AntText>
        </div>
      ),
    },
    {
      title: t('permissions.colEnabled'),
      key: 'enabled',
      width: 100,
      align: 'center',
      render: (_: unknown, record: KocItem) => {
        if (!manager) return null;
        return (
          <Switch
            checked={isKocEnabled(manager.id, record.id)}
            loading={saving === `toggle-${record.id}`}
            onChange={(checked) => onKocToggle(manager.id, record.id, checked)}
          />
        );
      },
    },
    {
      title: t('permissions.colPermCount'),
      key: 'permCount',
      width: 120,
      align: 'center',
      render: (_: unknown, record: KocItem) => {
        if (!manager) return null;
        const entry = getKocAccess(manager.id, record.id);
        if (!entry) return <AntText type="secondary">-</AntText>;
        return <AppTag color="blue">{entry.permissions.length} / {kocPermDefs.length}</AppTag>;
      },
    },
    {
      title: t('permissions.colDetail'),
      key: 'detail',
      width: 70,
      align: 'center',
      render: (_: unknown, record: KocItem) => {
        if (!manager) return null;
        if (!isKocEnabled(manager.id, record.id)) return <AntText type="secondary">-</AntText>;
        return (
          <AppTooltip title={t('permissions.configureDetail')}>
            <Button
              type="default"
              shape="circle"
              icon={<SettingOutlined />}
              onClick={() => onOpenDetail(record)}
            />
          </AppTooltip>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        manager ? (
          <span>
            {t('permissions.kocListFor')}{' '}
            <AppTag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
              {manager.full_name}
            </AppTag>
          </span>
        ) : null
      }
      open={!!manager}
      onCancel={onClose}
      footer={null}
      width="min(900px, 100vw - 32px)"
      styles={{ body: { paddingTop: 12 } }}
      destroyOnClose
    >
      {manager && (
        <>
          <AntText type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {t('permissions.kocListDesc')}
          </AntText>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <Search
              placeholder={t('permissions.searchKoc')}
              value={kocSearch}
              onChange={(e) => setKocSearch(e.target.value)}
              allowClear
              style={{ maxWidth: 300 }}
            />
            <Button
              size="small"
              type={allSelected ? 'default' : 'primary'}
              loading={saving === 'bulk'}
              onClick={() => onSelectAll(manager.id, !allSelected)}
            >
              {allSelected ? t('permissions.deselectAll') : t('permissions.selectAll')}
            </Button>
          </div>
          <Table
            columns={kocColumns}
            dataSource={filteredKocs}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20', '50'],
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
              onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            }}
            size="small"
          />
        </>
      )}
    </Modal>
  );
};

export default KocAccessModal;
