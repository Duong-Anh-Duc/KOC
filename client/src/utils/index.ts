/**
 * Format a number as USD currency string
 */
export const formatUSD = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format a number as VND currency string
 */
export const formatVND = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '0 ₫';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

/**
 * Format a number with thousand separators
 */
export const formatNumber = (value: number | string | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format a percentage value
 */
export const formatPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${(num * 100).toFixed(1)}%`;
};

/**
 * Truncate a string to a maximum length
 */
export const truncate = (str: string, maxLen = 30): string => {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
};

/**
 * Build URL query string from object
 */
export const buildQueryString = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
};

/**
 * Debounce utility
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Get initials from a full name
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Export toast utilities
export { toastError, toastInfo, toastSuccess, toastWarning } from './toast';
export { appMessage, appNotification } from './appMessage';

// Export table utilities
export { getTableLocale } from './tableLocale';

// Export cron result formatter
export { formatCronResult } from './cronResultFormatter';

// Export audit formatter
export { formatAuditValue } from './auditFormatter';

