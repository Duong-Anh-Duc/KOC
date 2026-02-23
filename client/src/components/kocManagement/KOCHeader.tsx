import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

interface KOCHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  statusFilter: string | undefined;
  onStatusFilterChange: (value: string | undefined) => void;
  onRefresh: () => void;
  isAdmin: boolean;
  onCreate: () => void;
}

const KOCHeader: React.FC<KOCHeaderProps> = ({
  search,
  onSearchChange,
  onSearchSubmit,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  isAdmin,
  onCreate,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Title level={3} style={{ margin: 0 }}>{t('menu.koc')}</Title>
      <Space wrap>
        <Input
          placeholder={t('common.search')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onPressEnter={onSearchSubmit}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder={t('koc.status')}
          style={{ width: 150 }}
          value={statusFilter}
          onChange={onStatusFilterChange}
          allowClear
          options={[
            { value: 'ACTIVE', label: t('status.active') },
            { value: 'INACTIVE', label: t('status.inactive') },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {t('koc.create')}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default KOCHeader;
