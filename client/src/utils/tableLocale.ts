import type { TableProps } from 'antd';

export const getTableLocale = (t: (key: string) => string): TableProps<any>['locale'] => ({
  filterTitle: t('table.filterTitle'),
  filterConfirm: t('table.filterConfirm'),
  filterReset: t('table.filterReset'),
  filterEmptyText: t('table.filterEmptyText'),
  filterCheckall: t('table.filterCheckall'),
  filterSearchPlaceholder: t('table.filterSearchPlaceholder'),
  emptyText: t('table.emptyText'),
  selectAll: t('table.selectAll'),
  selectInvert: t('table.selectInvert'),
  selectNone: t('table.selectNone'),
  selectionAll: t('table.selectionAll'),
  sortTitle: t('table.sortTitle'),
  expand: t('table.expand'),
  collapse: t('table.collapse'),
  triggerDesc: t('table.triggerDesc'),
  triggerAsc: t('table.triggerAsc'),
  cancelSort: t('table.cancelSort'),
});
