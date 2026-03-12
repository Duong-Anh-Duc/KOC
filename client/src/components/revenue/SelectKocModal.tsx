import { Checkbox, Modal } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ActiveKOC {
  id: string;
  full_name: string;
  channel_name: string;
  base_rate: number;
}

interface SelectKocModalProps {
  open: boolean;
  onCancel: () => void;
  selectedKocIds: string[];
  setSelectedKocIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeKOCs: ActiveKOC[] | undefined;
  onConfirm: (kocIds: string[]) => void;
}

const SelectKocModal: React.FC<SelectKocModalProps> = ({
  open,
  onCancel,
  selectedKocIds,
  setSelectedKocIds,
  activeKOCs,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('revenue.scrapeSelected', 'Chọn KOC để cào')}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (selectedKocIds.length > 0) {
          onConfirm(selectedKocIds);
          onCancel();
        }
      }}
      okText={t('revenue.startScrape', 'Bắt đầu cào')}
      okButtonProps={{ disabled: selectedKocIds.length === 0 }}
    >
      <div style={{ marginBottom: 12 }}>
        <Checkbox
          indeterminate={selectedKocIds.length > 0 && selectedKocIds.length < (activeKOCs?.length || 0)}
          checked={selectedKocIds.length > 0 && selectedKocIds.length === (activeKOCs?.length || 0)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedKocIds(activeKOCs?.map(k => k.id) || []);
            } else {
              setSelectedKocIds([]);
            }
          }}
        >
          {t('common.selectAll', 'Chọn tất cả')} ({activeKOCs?.length || 0})
        </Checkbox>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        <Checkbox.Group
          value={selectedKocIds}
          onChange={(vals) => setSelectedKocIds(vals as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {activeKOCs?.map(koc => (
            <Checkbox key={koc.id} value={koc.id}>
              <span style={{ fontWeight: 500 }}>{koc.full_name}</span>
              <span style={{ color: '#888', marginLeft: 8 }}>({koc.channel_name})</span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </div>
    </Modal>
  );
};

export default SelectKocModal;
