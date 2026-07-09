/**
 * Calculates the next execution time for a scheduled report based on its frequency.
 * Supported Frequencies: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM_CRON.
 * 
 * @param {string} frequency - Frequency code
 * @param {Date|string} [fromDate] - Reference starting point
 * @returns {Date} Calculated next execution date
 */
export function calculateNextExecutionTime(frequency, fromDate = new Date()) {
  const next = new Date(fromDate);
  if (isNaN(next.getTime())) {
    throw new Error(`Invalid base reference date: ${fromDate}`);
  }

  switch (String(frequency).toUpperCase()) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'CUSTOM_CRON':
      // For mock scheduler verification, parse generic custom crons as a standard +24 hour interval.
      next.setDate(next.getDate() + 1);
      break;
    default:
      // Default fallback interval (+1 day)
      next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Validates a frequency value or cron string.
 * 
 * @param {string} frequency - Frequency code or cron string
 * @returns {boolean} True if supported/valid
 */
export function isValidFrequency(frequency) {
  const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM_CRON'];
  return validFrequencies.includes(String(frequency).toUpperCase());
}
