"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNumber = normalizeNumber;
exports.parseNumber = parseNumber;
exports.parseIntegerValue = parseIntegerValue;
exports.parseDecimalValue = parseDecimalValue;
exports.parseRevenueValue = parseRevenueValue;
exports.parsePercentValue = parsePercentValue;
exports.parseTimeValue = parseTimeValue;
exports.isDash = isDash;
exports.isTimeLine = isTimeLine;
exports.isDollarLine = isDollarLine;
exports.isVndLine = isVndLine;
exports.isPercentLine = isPercentLine;
exports.isNumberLine = isNumberLine;
exports.isValueLine = isValueLine;
exports.isCountryName = isCountryName;
exports.isDateLine = isDateLine;
exports.parseTotalRow = parseTotalRow;
exports.parseDimensionRowValues = parseDimensionRowValues;
const exchange_rate_service_1 = require("../services/exchange-rate.service");
// ============================================================
// Number Normalization & Parsing
// ============================================================
/**
 * Normalize a number string that may use Vietnamese formatting
 * (e.g. "1.234,56" → "1234.56", "1.234" with >2 decimal digits → "1234")
 */
function normalizeNumber(str) {
    let cleaned = str.trim();
    if (cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    else if (cleaned.includes('.')) {
        const parts = cleaned.split('.');
        if (parts.length > 2 || (parts[1] && parts[1].length > 2)) {
            cleaned = cleaned.replace(/\./g, '');
        }
    }
    return cleaned;
}
/**
 * Parse a number string, handling locale formatting.
 * Returns 0 if unparseable.
 */
function parseNumber(str) {
    if (!str)
        return 0;
    const cleaned = normalizeNumber(str);
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 1000000) / 1000000;
}
/**
 * Parse an integer value, stripping non-numeric chars.
 * Returns null if empty/invalid.
 */
function parseIntegerValue(str) {
    if (!str)
        return null;
    const cleaned = str.replace(/[^\d.,-]/g, '');
    if (!cleaned)
        return null;
    const normalized = normalizeNumber(cleaned);
    const num = parseInt(normalized, 10);
    return isNaN(num) ? null : num;
}
/**
 * Parse a decimal value (e.g. watch time hours).
 * Returns null if empty/invalid.
 */
function parseDecimalValue(str) {
    if (!str)
        return null;
    const cleaned = str.replace(/[^\d.,-]/g, '');
    if (!cleaned)
        return null;
    const num = parseNumber(cleaned);
    return num || null;
}
/**
 * Parse a revenue/dollar value. Handles both USD ($) and VND (₫).
 * VND amounts are automatically converted to USD using the cached exchange rate.
 * Returns null if empty/invalid.
 */
function parseRevenueValue(str) {
    if (!str)
        return null;
    // Handle VND currency (₫)
    if (str.includes('₫')) {
        const vndCleaned = str.replace(/[₫\s]/g, '');
        if (!vndCleaned)
            return null;
        const vndAmount = parseNumber(vndCleaned);
        if (!vndAmount || isNaN(vndAmount))
            return null;
        const usdAmount = exchange_rate_service_1.ExchangeRateService.convertVndToUsd(vndAmount);
        return usdAmount;
    }
    // Handle USD currency ($) or plain number
    const cleaned = str.replace(/[$\s]/g, '');
    if (!cleaned)
        return null;
    const num = parseNumber(cleaned);
    return isNaN(num) ? null : num;
}
/**
 * Parse a percentage value (strips %).
 * Returns null if empty/invalid.
 */
function parsePercentValue(str) {
    if (!str)
        return null;
    const cleaned = str.replace(/%/g, '').trim();
    if (!cleaned)
        return null;
    const num = parseNumber(cleaned);
    return isNaN(num) ? null : num;
}
/**
 * Parse a time value like "3:42" from a string.
 * Returns null if no match.
 */
function parseTimeValue(str) {
    if (!str)
        return null;
    const match = str.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : null;
}
// ============================================================
// Line Classifiers (for explore table text parsing)
// ============================================================
/** Check if string is a dash character (—, –, -) */
function isDash(s) {
    return /^[—–-]+$/.test(s.trim());
}
/** Check if string is a time like "3:42" */
function isTimeLine(s) {
    return /^\d{1,2}:\d{2}$/.test(s.trim());
}
/** Check if string contains a dollar amount */
function isDollarLine(s) {
    return /\$/.test(s) && /\d/.test(s);
}
/** Check if string contains a VND amount (₫) */
function isVndLine(s) {
    return /₫/.test(s) && /\d/.test(s);
}
/** Check if string is a percentage like "12,5%" */
function isPercentLine(s) {
    return /\d/.test(s) && /%/.test(s.trim());
}
/** Check if string is a plain number like "1.234" or "5,678" */
function isNumberLine(s) {
    return /^[\d.,]+$/.test(s.trim());
}
/** Check if string looks like a value line (number, dollar, percent, time, or dash) */
function isValueLine(s) {
    const t = s.trim();
    if (!t || t.length > 30)
        return false;
    // Filter out UI texts (Vietnamese, English, Spanish)
    if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(t))
        return false;
    return isDash(t) || isTimeLine(t) || isDollarLine(t) || isVndLine(t) ||
        isPercentLine(t) || isNumberLine(t);
}
/** Check if a line looks like a country name */
function isCountryName(line) {
    if (!line || line.length < 2 || line.length > 60)
        return false;
    if (isValueLine(line))
        return false;
    if (/^(Tổng|Total|Địa lý|Geography|Ngày|Day)$/i.test(line))
        return false;
    if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line))
        return false;
    // Filter out UI texts (Vietnamese, English, Spanish)
    if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line))
        return false;
    if (/\$|giờ|hour|xem|view|thu|revenue|đăng ký|subscriber|thích|like|chia sẻ|share|lượt|người/i.test(line))
        return false;
    if (/^[A-ZÀ-Ỹ][a-zà-ỹ]/.test(line))
        return true;
    return false;
}
/** Check if a line looks like a date (Vietnamese or English format) */
function isDateLine(line) {
    if (!line || line.length < 5 || line.length > 30)
        return false;
    // Vietnamese: "12 thg 2, 2026" or "12 thg 2"
    if (/^\d{1,2}\s+thg\s+\d{1,2}/i.test(line.trim()))
        return true;
    // English: "Feb 12, 2026"
    if (/^[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4}$/i.test(line.trim()))
        return true;
    return false;
}
// ============================================================
// Generic Row Parsers (for explore table data)
// ============================================================
/**
 * Parse Total row values (no percentages for number columns).
 * Used for both country and day explore tables.
 */
function parseTotalRow(values, specs) {
    const result = {};
    let idx = 0;
    for (const spec of specs) {
        if (idx >= values.length)
            break;
        const val = values[idx];
        switch (spec.type) {
            case 'number_percent':
                result[spec.key] = isDash(val) ? null :
                    (spec.key === 'watchTimeHours' ? parseDecimalValue(val) : parseIntegerValue(val));
                idx++;
                break;
            case 'dollar_percent':
                result[spec.key] = isDash(val) ? null : parseRevenueValue(val);
                idx++;
                break;
            case 'standalone_percent_or_dash':
                result[spec.key] = isDash(val) ? null : parsePercentValue(val);
                idx++;
                break;
            case 'standalone_num_or_dash':
                result[spec.key] = isDash(val) ? null : parseIntegerValue(val);
                idx++;
                break;
            case 'standalone_time':
                result[spec.key] = isDash(val) ? null : (parseTimeValue(val) || val);
                idx++;
                break;
        }
    }
    return result;
}
/**
 * Parse a dimension row (country or day) with value+percent pairs.
 * Country rows have value+percent pairs for most columns.
 * Day rows have value+percent pairs for number/dollar columns.
 */
function parseDimensionRowValues(label, values, specs, dimension) {
    const row = dimension === 'country' ? { country: label } : { date: label };
    let idx = 0;
    for (const spec of specs) {
        if (idx >= values.length)
            break;
        const val = values[idx];
        switch (spec.type) {
            case 'number_percent': {
                if (isDash(val)) {
                    row[spec.key] = null;
                    idx++;
                }
                else {
                    row[spec.key] = spec.key === 'watchTimeHours'
                        ? parseDecimalValue(val)
                        : parseIntegerValue(val);
                    idx++;
                    // Check for following percent
                    if (idx < values.length && isPercentLine(values[idx])) {
                        row[spec.key + 'Percent'] = parsePercentValue(values[idx]);
                        idx++;
                    }
                }
                break;
            }
            case 'dollar_percent': {
                if (isDash(val)) {
                    row[spec.key] = null;
                    idx++;
                }
                else {
                    row[spec.key] = parseRevenueValue(val);
                    idx++;
                    if (idx < values.length && isPercentLine(values[idx])) {
                        row[spec.key + 'Percent'] = parsePercentValue(values[idx]);
                        idx++;
                    }
                }
                break;
            }
            case 'standalone_percent_or_dash': {
                if (isDash(val)) {
                    row[spec.key] = null;
                }
                else if (isPercentLine(val)) {
                    row[spec.key] = parsePercentValue(val);
                }
                else {
                    row[spec.key] = null;
                }
                idx++;
                break;
            }
            case 'standalone_num_or_dash': {
                if (isDash(val)) {
                    row[spec.key] = null;
                }
                else {
                    row[spec.key] = parseIntegerValue(val);
                }
                idx++;
                break;
            }
            case 'standalone_time': {
                if (isDash(val)) {
                    row[spec.key] = null;
                }
                else {
                    row[spec.key] = parseTimeValue(val) || val;
                }
                idx++;
                break;
            }
        }
    }
    return row;
}
//# sourceMappingURL=parseHelpers.js.map