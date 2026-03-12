import { CloudSyncOutlined } from '@ant-design/icons';
import { Checkbox, List, Modal, Space } from 'antd';
import React from 'react';
import type { RevenueCycle, RevenueRecord } from '../../types';

interface GemLoginScrapeModalProps {
  open: boolean;
  onCancel: () => void;
  gemLoginSelectedIds: string[];
  setGemLoginSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  records: RevenueRecord[];
  selectedCycle: RevenueCycle | undefined;
  onConfirm: (cycleId: number, kocIds: string[]) => void;
}

const GemLoginScrapeModal: React.FC<GemLoginScrapeModalProps> = ({
  open,
  onCancel,
  gemLoginSelectedIds,
  setGemLoginSelectedIds,
  records,
  selectedCycle,
  onConfirm,
}) => {
  return (
    <Modal
      title={<Space><CloudSyncOutlined /> {`Cào doanh thu — Chọn KOC (${selectedCycle?.month})`}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (selectedCycle && gemLoginSelectedIds.length > 0) {
          onConfirm(selectedCycle.id, gemLoginSelectedIds);
        }
        onCancel();
      }}
      okText={`Cào ${gemLoginSelectedIds.length} KOC`}
      okButtonProps={{ disabled: gemLoginSelectedIds.length === 0, icon: <CloudSyncOutlined /> }}
    >
      <div style={{ marginBottom: 12 }}>
        <Checkbox
          indeterminate={gemLoginSelectedIds.length > 0 && gemLoginSelectedIds.length < records.length}
          checked={gemLoginSelectedIds.length === records.length && records.length > 0}
          onChange={(e) => setGemLoginSelectedIds(e.target.checked ? records.map(r => r.koc_id) : [])}
        >
          Chọn tất cả ({records.length})
        </Checkbox>
      </div>
      <List
        size="small"
        style={{ maxHeight: 400, overflowY: 'auto' }}
        dataSource={records}
        renderItem={(record) => (
          <List.Item style={{ padding: '4px 0' }}>
            <Checkbox
              checked={gemLoginSelectedIds.includes(record.koc_id)}
              onChange={(e) => {
                setGemLoginSelectedIds(prev =>
                  e.target.checked ? [...prev, record.koc_id] : prev.filter(id => id !== record.koc_id)
                );
              }}
            >
              <span style={{ fontWeight: 500 }}>{record.koc?.full_name ?? record.koc_id}</span>
            </Checkbox>
          </List.Item>
        )}
      />
    </Modal>
  );
};

export default GemLoginScrapeModal;
