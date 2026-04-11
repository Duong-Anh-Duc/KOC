import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Grid, Input, Select, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;
const { useBreakpoint } = Grid;

interface KOCHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  statusFilter: string | undefined;
  onStatusFilterChange: (value: string | undefined) => void;
  onRefresh: () => void;
  canEdit: boolean;
  onCreate: () => void;
}

const KOCHeader: React.FC<KOCHeaderProps> = ({
  search,
  onSearchChange,
  onSearchSubmit,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  canEdit,
  onCreate,
}) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0, marginBottom: 16 }}>
      <Title level={3} style={{ margin: 0 }}>{t('menu.koc')}</Title>
      <Space wrap size="small">
        <Input
          placeholder={t('common.search')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onPressEnter={onSearchSubmit}
          style={{ width: isMobile ? '100%' : 250, minWidth: isMobile ? 0 : undefined }}
          allowClear
        />
        <Select
          placeholder={t('koc.status')}
          style={{ width: isMobile ? 120 : 150 }}
          value={statusFilter}
          onChange={onStatusFilterChange}
          allowClear
          options={[
            { value: 'ACTIVE', label: t('status.active') },
            { value: 'INACTIVE', label: t('status.inactive') },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {isMobile ? '' : t('koc.create')}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default KOCHeader;
