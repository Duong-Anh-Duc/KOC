import { Modal, Switch, Tag, Typography } from 'antd';
import { AppTag } from '../common';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KocAccessEntry, KocItem, KocPermDef, ManagerUser } from '../../api/permission.api';

const { Text } = Typography;

interface Props {
  manager: ManagerUser | null;
  koc: KocItem | null;
  entry: KocAccessEntry | null;
  kocPermDefs: KocPermDef[];
  saving: string | null;
  onClose: () => void;
  onPermToggle: (managerId: string, kocId: string, permKey: string, checked: boolean) => void;
}

const PermissionDetailModal: React.FC<Props> = ({
  manager, koc, entry, kocPermDefs, saving, onClose, onPermToggle,
}) => {
  const { t } = useTranslation();

  const renderPermRow = (def: KocPermDef) => {
    if (!manager || !koc || !entry) return null;
    const checked = entry.permissions.includes(def.key);
    const isSaving = saving === `perm-${koc.id}-${def.key}`;
    const isBasic = def.group === 'basic';
    return (
      <div
        key={def.key}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderRadius: 8,
          marginBottom: 6,
          background: checked
            ? (isBasic ? 'rgba(22, 119, 255, 0.04)' : 'rgba(250, 140, 22, 0.06)')
            : 'transparent',
          border: checked
            ? (isBasic ? '1px solid rgba(22, 119, 255, 0.15)' : '1px solid rgba(250, 140, 22, 0.25)')
            : '1px solid #f0f0f0',
          transition: 'all 0.2s',
        }}
      >
        <Text style={{ fontSize: 14 }}>{t(def.label)}</Text>
        <Switch
          checked={checked}
          loading={isSaving}
          onChange={(val) => onPermToggle(manager.id, koc.id, def.key, val)}
        />
      </div>
    );
  };

  return (
    <Modal
      title={
        koc ? (
          <span>
            {t('permissions.detailTitle')}{' '}
            <AppTag color="orange" style={{ fontSize: 14 }}>{koc.full_name}</AppTag>
          </span>
        ) : null
      }
      open={!!koc}
      onCancel={onClose}
      footer={null}
      width="min(480px, 100vw - 32px)"
      destroyOnClose
    >
      {koc && manager && entry && (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('permissions.detailDesc')}
          </Text>

          <Text strong style={{ fontSize: 13, color: '#1677ff', display: 'block', marginBottom: 8 }}>
            {t('permissions.groupBasic')}
          </Text>
          {kocPermDefs.filter((d) => d.group === 'basic').map(renderPermRow)}

          <Text strong style={{ fontSize: 13, color: '#fa8c16', display: 'block', margin: '16px 0 8px' }}>
            {t('permissions.groupAdvanced')}
          </Text>
          {kocPermDefs.filter((d) => d.group === 'advanced').map(renderPermRow)}
        </div>
      )}
    </Modal>
  );
};

export default PermissionDetailModal;
