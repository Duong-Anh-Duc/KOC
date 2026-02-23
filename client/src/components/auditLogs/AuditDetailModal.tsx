import { Descriptions, Modal, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AuditLog } from '../../types';
import { formatAuditValue } from '../../utils';

const { Text } = Typography;

const entityColorMap: Record<string, string> = {
  KOC: 'blue',
  REVENUE_RECORD: 'green',
  REVENUE_CYCLE: 'orange',
  USER: 'purple',
  CHANNEL_STAT: 'cyan',
  SYSTEM_CONFIG: 'magenta',
};

interface AuditDetailModalProps {
  log: AuditLog | null;
  onClose: () => void;
}

const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ log, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('common.details')}
      open={!!log}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {log && (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label={t('audit.id')}>
            <Text copyable>{log.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('audit.action')}>
            <Tag color={
              log.action === 'CREATE' ? 'green' :
              log.action === 'UPDATE' ? 'blue' :
              log.action === 'DELETE' ? 'red' :
              log.action === 'APPROVE' ? 'orange' : 'default'
            }>
              {t(`audit.actions.${log.action}`, log.action)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('audit.entity')}>
            <Tag color={entityColorMap[log.entity] || 'default'}>
              {t(`audit.entities.${log.entity}`, log.entity)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('audit.entityId')}>
            <Text copyable code>{log.entity_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('audit.user')}>
            <Space direction="vertical" size={0}>
              <Text strong>{log.user?.full_name || '-'}</Text>
              <Text type="secondary">{log.user?.email || '-'}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label={t('common.createdAt')}>
            {dayjs(log.timestamp).format('DD/MM/YYYY HH:mm:ss')}
          </Descriptions.Item>
          {log.old_value && (
            <Descriptions.Item label={t('audit.oldValue')}>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: 12, 
                borderRadius: 4, 
                maxHeight: 200,
                overflow: 'auto',
                fontSize: 12,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify(formatAuditValue(log.old_value, t), null, 2)}
              </pre>
            </Descriptions.Item>
          )}
          {log.new_value && (
            <Descriptions.Item label={t('audit.newValue')}>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: 12, 
                borderRadius: 4, 
                maxHeight: 200,
                overflow: 'auto',
                fontSize: 12,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify(formatAuditValue(log.new_value, t), null, 2)}
              </pre>
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Modal>
  );
};

export default AuditDetailModal;
