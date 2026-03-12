import { CalendarOutlined } from '@ant-design/icons';
import { Checkbox, List, Modal } from 'antd';
import React from 'react';
import type { RevenueRecord } from '../../types';

interface ActiveKOC {
  id: string;
  full_name: string;
  channel_name: string;
  base_rate: number;
}

interface ScrapeMonthlyModalProps {
  open: boolean;
  onCancel: () => void;
  monthlySelectedIds: string[];
  setMonthlySelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  records: RevenueRecord[];
  activeKOCs: ActiveKOC[] | undefined;
  onConfirm: (kocIds: string[]) => void;
}

const ScrapeMonthlyModal: React.FC<ScrapeMonthlyModalProps> = ({
  open,
  onCancel,
  monthlySelectedIds,
  setMonthlySelectedIds,
  records,
  activeKOCs,
  onConfirm,
}) => {
  return (
    <Modal
      title={`Chọn KOC để cào dữ liệu tháng (${records.length} KOC trong chu kỳ)`}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (monthlySelectedIds.length > 0) {
          onConfirm(monthlySelectedIds);
          onCancel();
        }
      }}
      okText={`Cào ${monthlySelectedIds.length} KOC`}
      okButtonProps={{ disabled: monthlySelectedIds.length === 0, icon: <CalendarOutlined /> }}
    >
      <div style={{ marginBottom: 12 }}>
        <Checkbox
          indeterminate={monthlySelectedIds.length > 0 && monthlySelectedIds.length < records.length}
          checked={monthlySelectedIds.length === records.length && records.length > 0}
          onChange={(e) => setMonthlySelectedIds(e.target.checked ? records.map(r => r.koc_id) : [])}
        >
          Chọn tất cả ({records.length})
        </Checkbox>
      </div>
      <List
        size="small"
        style={{ maxHeight: 400, overflowY: 'auto' }}
        dataSource={records}
        renderItem={(record) => {
          const koc = activeKOCs?.find(k => k.id === record.koc_id);
          return (
            <List.Item style={{ padding: '4px 0' }}>
              <Checkbox
                checked={monthlySelectedIds.includes(record.koc_id)}
                onChange={(e) => {
                  setMonthlySelectedIds(prev =>
                    e.target.checked ? [...prev, record.koc_id] : prev.filter(id => id !== record.koc_id)
                  );
                }}
              >
                <span style={{ fontWeight: 500 }}>{koc?.full_name || record.koc_id}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>({koc?.channel_name || ''})</span>
              </Checkbox>
            </List.Item>
          );
        }}
      />
    </Modal>
  );
};

export default ScrapeMonthlyModal;
