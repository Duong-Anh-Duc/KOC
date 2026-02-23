/**
 * Format currency with locale support
 */
export const formatCurrency = (value: number, currency: 'USD' | 'VND' = 'USD'): string => {
  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

/**
 * Parse Decimal from Prisma to number
 */
export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return Number(value);
};

/**
 * Generate month string in MM/YYYY format
 */
export const getCurrentMonth = (): string => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return `${month}/${year}`;
};

/**
 * Sleep utility for rate limiting API calls
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ============================================================
// PARSE HELPERS (re-export)
// ============================================================

export {
  isCountryName, isDash, isDateLine, isDollarLine, isNumberLine, isPercentLine, isTimeLine, isValueLine, normalizeNumber, parseDecimalValue, parseDimensionRowValues, parseIntegerValue, parseNumber, parsePercentValue, parseRevenueValue, parseTimeValue, parseTotalRow
} from './parseHelpers';

