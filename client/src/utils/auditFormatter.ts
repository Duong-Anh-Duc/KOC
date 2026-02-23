import { TFunction } from 'i18next';
import { formatCronResult } from './cronResultFormatter';

/**
 * Format audit log values for display
 * Translates messages and handles special formatting
 */
export function formatAuditValue(value: any, t: TFunction): any {
  if (!value || typeof value !== 'object') {
    return value;
  }

  // Create a copy to avoid mutating the original
  const formatted = { ...value };

  // If the value has a 'message' field, try to translate it
  if (typeof formatted.message === 'string') {
    formatted.message = formatCronResult(formatted.message, t);
  }

  return formatted;
}
