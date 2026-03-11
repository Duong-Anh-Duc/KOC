import type { ColumnSpec } from '../types/stats.types';
/**
 * Normalize a number string that may use Vietnamese formatting
 * (e.g. "1.234,56" → "1234.56", "1.234" with >2 decimal digits → "1234")
 */
export declare function normalizeNumber(str: string): string;
/**
 * Parse a number string, handling locale formatting.
 * Returns 0 if unparseable.
 */
export declare function parseNumber(str: string): number;
/**
 * Parse an integer value, stripping non-numeric chars.
 * Returns null if empty/invalid.
 */
export declare function parseIntegerValue(str: string | undefined): number | null;
/**
 * Parse a decimal value (e.g. watch time hours).
 * Returns null if empty/invalid.
 */
export declare function parseDecimalValue(str: string | undefined): number | null;
/**
 * Parse a revenue/dollar value. Handles both USD ($) and VND (₫).
 * VND amounts are automatically converted to USD using the cached exchange rate.
 * Returns null if empty/invalid.
 */
export declare function parseRevenueValue(str: string | undefined): number | null;
/**
 * Parse a percentage value (strips %).
 * Returns null if empty/invalid.
 */
export declare function parsePercentValue(str: string | undefined): number | null;
/**
 * Parse a time value like "3:42" from a string.
 * Returns null if no match.
 */
export declare function parseTimeValue(str: string | undefined): string | null;
/** Check if string is a dash character (—, –, -) */
export declare function isDash(s: string): boolean;
/** Check if string is a time like "3:42" */
export declare function isTimeLine(s: string): boolean;
/** Check if string contains a dollar amount */
export declare function isDollarLine(s: string): boolean;
/** Check if string contains a VND amount (₫) */
export declare function isVndLine(s: string): boolean;
/** Check if string is a percentage like "12,5%" */
export declare function isPercentLine(s: string): boolean;
/** Check if string is a plain number like "1.234" or "5,678" */
export declare function isNumberLine(s: string): boolean;
/** Check if string looks like a value line (number, dollar, percent, time, or dash) */
export declare function isValueLine(s: string): boolean;
/** Check if a line looks like a country name */
export declare function isCountryName(line: string): boolean;
/** Check if a line looks like a date (Vietnamese or English format) */
export declare function isDateLine(line: string): boolean;
/**
 * Parse Total row values (no percentages for number columns).
 * Used for both country and day explore tables.
 */
export declare function parseTotalRow(values: string[], specs: ColumnSpec[]): Record<string, any>;
/**
 * Parse a dimension row (country or day) with value+percent pairs.
 * Country rows have value+percent pairs for most columns.
 * Day rows have value+percent pairs for number/dollar columns.
 */
export declare function parseDimensionRowValues(label: string, values: string[], specs: ColumnSpec[], dimension: 'country' | 'day'): Record<string, any>;
//# sourceMappingURL=parseHelpers.d.ts.map