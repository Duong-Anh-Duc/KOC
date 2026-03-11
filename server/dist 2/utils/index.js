"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTotalRow = exports.parseTimeValue = exports.parseRevenueValue = exports.parsePercentValue = exports.parseNumber = exports.parseIntegerValue = exports.parseDimensionRowValues = exports.parseDecimalValue = exports.normalizeNumber = exports.isValueLine = exports.isTimeLine = exports.isPercentLine = exports.isNumberLine = exports.isDollarLine = exports.isDateLine = exports.isDash = exports.isCountryName = exports.sleep = exports.getCurrentMonth = exports.toNumber = exports.formatCurrency = void 0;
/**
 * Format currency with locale support
 */
const formatCurrency = (value, currency = 'USD') => {
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
exports.formatCurrency = formatCurrency;
/**
 * Parse Decimal from Prisma to number
 */
const toNumber = (value) => {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string')
        return parseFloat(value);
    return Number(value);
};
exports.toNumber = toNumber;
/**
 * Generate month string in MM/YYYY format
 */
const getCurrentMonth = () => {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${month}/${year}`;
};
exports.getCurrentMonth = getCurrentMonth;
/**
 * Sleep utility for rate limiting API calls
 */
const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
exports.sleep = sleep;
// ============================================================
// PARSE HELPERS (re-export)
// ============================================================
var parseHelpers_1 = require("./parseHelpers");
Object.defineProperty(exports, "isCountryName", { enumerable: true, get: function () { return parseHelpers_1.isCountryName; } });
Object.defineProperty(exports, "isDash", { enumerable: true, get: function () { return parseHelpers_1.isDash; } });
Object.defineProperty(exports, "isDateLine", { enumerable: true, get: function () { return parseHelpers_1.isDateLine; } });
Object.defineProperty(exports, "isDollarLine", { enumerable: true, get: function () { return parseHelpers_1.isDollarLine; } });
Object.defineProperty(exports, "isNumberLine", { enumerable: true, get: function () { return parseHelpers_1.isNumberLine; } });
Object.defineProperty(exports, "isPercentLine", { enumerable: true, get: function () { return parseHelpers_1.isPercentLine; } });
Object.defineProperty(exports, "isTimeLine", { enumerable: true, get: function () { return parseHelpers_1.isTimeLine; } });
Object.defineProperty(exports, "isValueLine", { enumerable: true, get: function () { return parseHelpers_1.isValueLine; } });
Object.defineProperty(exports, "normalizeNumber", { enumerable: true, get: function () { return parseHelpers_1.normalizeNumber; } });
Object.defineProperty(exports, "parseDecimalValue", { enumerable: true, get: function () { return parseHelpers_1.parseDecimalValue; } });
Object.defineProperty(exports, "parseDimensionRowValues", { enumerable: true, get: function () { return parseHelpers_1.parseDimensionRowValues; } });
Object.defineProperty(exports, "parseIntegerValue", { enumerable: true, get: function () { return parseHelpers_1.parseIntegerValue; } });
Object.defineProperty(exports, "parseNumber", { enumerable: true, get: function () { return parseHelpers_1.parseNumber; } });
Object.defineProperty(exports, "parsePercentValue", { enumerable: true, get: function () { return parseHelpers_1.parsePercentValue; } });
Object.defineProperty(exports, "parseRevenueValue", { enumerable: true, get: function () { return parseHelpers_1.parseRevenueValue; } });
Object.defineProperty(exports, "parseTimeValue", { enumerable: true, get: function () { return parseHelpers_1.parseTimeValue; } });
Object.defineProperty(exports, "parseTotalRow", { enumerable: true, get: function () { return parseHelpers_1.parseTotalRow; } });
//# sourceMappingURL=index.js.map