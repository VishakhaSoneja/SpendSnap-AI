const TRANSACTION_TYPES = Object.freeze(['Income', 'Expense', 'Investment']);

const CATEGORIES = Object.freeze([
  'Food',
  'Shopping',
  'Travel',
  'Bills',
  'Health',
  'Education',
  'Entertainment',
  'Investment',
  'Salary',
  'Freelancing',
  'Pocket Money',
  'Other',
]);

const INCOME_CATEGORIES = Object.freeze(['Salary', 'Freelancing', 'Pocket Money', 'Investment', 'Other']);

const EXPENSE_CATEGORIES = Object.freeze(
  CATEGORIES.filter((c) => !INCOME_CATEGORIES.includes(c))
);

const ASSET_TYPES = Object.freeze([
  'Investment',
  'Stocks',
  'Mutual Funds',
  'Gold',
  'Crypto',
  'FD',
  'Real Estate',
  'Bonds',
  'Other',
]);

const NOTIFICATION_TYPES = Object.freeze(['info', 'success', 'warning', 'danger']);

const INSIGHT_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

const GOAL_STATUSES = Object.freeze(['active', 'paused', 'achieved']);

const CURRENCIES = Object.freeze(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']);

const PAYMENT_METHODS = Object.freeze(['Cash', 'Card', 'UPI', 'Net Banking', 'Bank Transfer', 'Auto-pay', 'Other']);

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Formats a Date as a "YYYY-MM" month key in local time.
 */
const monthKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Builds a Date range for a given "YYYY-MM" month key (inclusive start, exclusive end).
 */
const monthRange = (key) => {
  const [year, month] = key.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
};

/**
 * Formats a Date as a "YYYY-MM-DD" date key in local time (transactions store date-only keys).
 */
const dateKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isValidCategory = (category) => CATEGORIES.includes(category);

const isValidMonthKey = (key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key);

module.exports = {
  TRANSACTION_TYPES,
  CATEGORIES,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  ASSET_TYPES,
  NOTIFICATION_TYPES,
  INSIGHT_PRIORITIES,
  GOAL_STATUSES,
  CURRENCIES,
  PAYMENT_METHODS,
  round2,
  monthKey,
  monthRange,
  dateKey,
  isValidCategory,
  isValidMonthKey,
};
