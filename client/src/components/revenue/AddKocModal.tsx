import { Checkbox, List, Modal } from 'antd';
import React from 'react';

interface ActiveKOC {
  id: string;
  full_name: string;
  channel_name: string;
  base_rate: number;
}

interface AddKocModalProps {
  open: boolean;
  onCancel: () => void;
  addKocSelectedIds: string[];
  setAddKocSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  missingKOCs: ActiveKOC[];
  onConfirm: (kocIds: string[]) => void;
}

const AddKocModal: React.FC<AddKocModalProps> = ({
  open,
  onCancel,
  addKocSelectedIds,
  setAddKocSelectedIds,
  missingKOCs,
  onConfirm,
}) => {
  return (
    <Modal
      title={`Thêm KOC vào chu kỳ (${missingKOCs.length} KOC chưa có)`}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (addKocSelectedIds.length > 0) {
          onConfirm(addKocSelectedIds);
          onCancel();
        }
      }}
      okText={`Thêm ${addKocSelectedIds.length} KOC`}
      okButtonProps={{ disabled: addKocSelectedIds.length === 0 }}
    >
      <div style={{ marginBottom: 12 }}>
        <Checkbox
          indeterminate={addKocSelectedIds.length > 0 && addKocSelectedIds.length < missingKOCs.length}
          checked={addKocSelectedIds.length === missingKOCs.length && missingKOCs.length > 0}
          onChange={(e) => setAddKocSelectedIds(e.target.checked ? missingKOCs.map(k => k.id) : [])}
        >
          Chọn tất cả ({missingKOCs.length})
        </Checkbox>
      </div>
      <List
        size="small"
        style={{ maxHeight: 400, overflowY: 'auto' }}
        dataSource={missingKOCs}
        renderItem={(koc) => (
          <List.Item style={{ padding: '4px 0' }}>
            <Checkbox
              checked={addKocSelectedIds.includes(koc.id)}
              onChange={(e) => {
                setAddKocSelectedIds(prev =>
                  e.target.checked ? [...prev, koc.id] : prev.filter(id => id !== koc.id)
                );
              }}
            >
              <span style={{ fontWeight: 500 }}>{koc.full_name}</span>
              <span style={{ color: '#888', marginLeft: 8 }}>({koc.channel_name})</span>
            </Checkbox>
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default AddKocModal;
