/**
 * Format currency with locale support
 */
export declare const formatCurrency: (value: number, currency?: "USD" | "VND") => string;
/**
 * Parse Decimal from Prisma to number
 */
export declare const toNumber: (value: unknown) => number;
/**
 * Generate month string in MM/YYYY format
 */
export declare const getCurrentMonth: () => string;
/**
 * Sleep utility for rate limiting API calls
 */
export declare const sleep: (ms: number) => Promise<void>;
export { isCountryName, isDash, isDateLine, isDollarLine, isNumberLine, isPercentLine, isTimeLine, isValueLine, normalizeNumber, parseDecimalValue, parseDimensionRowValues, parseIntegerValue, parseNumber, parsePercentValue, parseRevenueValue, parseTimeValue, parseTotalRow } from './parseHelpers';
//# sourceMappingURL=index.d.ts.map