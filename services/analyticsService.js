const transactionModel = require('../models/transactionModel');
const { monthRange, dateKey, round2 } = require('../utils/constants');

const toDateKey = (date) => dateKey(date);

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const startOfYear = (date) => new Date(date.getFullYear(), 0, 1);

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addDaysToKey = (key, days) => {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days));
};

const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const fill = (keys, map) => keys.map((key) => map[key] || { key, total: 0, count: 0 });

/**
 * Sum of transactions matching type within a date range.
 */
const totalsBetween = (userId, type, start, end) => transactionModel.totalsBetween(userId, type, toDateKey(start), toDateKey(end));

/**
 * Spend grouped by category (used by dashboard + AI).
 */
const categoryBreakdown = (userId, start, end, type = 'Expense') => {
  const rows = transactionModel.categoryBreakdown(userId, toDateKey(start), toDateKey(end), type);
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  return rows.map((r) => ({
    ...r,
    percentage: grandTotal > 0 ? round2((r.total / grandTotal) * 100) : 0,
  }));
};

/**
 * Daily series across a range, zero-filled so charts render continuous days.
 */
const dailySeries = (userId, start, end, type = 'Expense') => {
  const startKey = toDateKey(start);
  // End is inclusive of the end day (a partial day like "today" still counts).
  const endKey = addDaysToKey(toDateKey(end), 1);

  const map = {};
  transactionModel
    .seriesBetween(userId, type, startKey, endKey, 'day')
    .forEach((r) => {
      map[r.key] = r;
    });

  const series = [];
  const cursor = new Date(startKey);
  while (toDateKey(cursor) < endKey) {
    const key = toDateKey(cursor);
    series.push(map[key] || { key, total: 0, count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
};

/**
 * Weekly series for the trailing N weeks (Monday-start weeks).
 */
const weeklySeries = (userId, weeks = 8, type = 'Expense') => {
  const today = new Date();
  const start = startOfWeek(today);
  const startKey = toDateKey(addDays(start, -(weeks - 1) * 7));
  const endKey = addDaysToKey(toDateKey(today), 1);

  const map = {};
  transactionModel
    .seriesBetween(userId, type, startKey, endKey, 'day')
    .forEach((r) => {
      const rowDate = new Date(`${r.key}T00:00:00`);
      const weekStart = startOfWeek(rowDate);
      const key = toDateKey(weekStart);
      if (!map[key]) map[key] = { key, total: 0, count: 0 };
      map[key].total = round2(map[key].total + r.total);
      map[key].count += r.count;
    });

  const keys = [];
  for (let i = 0; i < weeks; i += 1) {
    keys.push(toDateKey(addDays(start, i * 7)));
  }

  return fill(keys, map);
};

/**
 * Monthly series for the trailing N months (keys are "YYYY-MM").
 */
const monthlySeries = (userId, months = 12, type = 'Expense') => {
  const today = new Date();
  const startKey = monthRange(monthKeyOf(addMonths(today, -(months - 1)))).start;
  const start = toDateKey(startKey);
  const end = addDaysToKey(toDateKey(today), 1);

  const map = {};
  transactionModel
    .seriesBetween(userId, type, start, end, 'month')
    .forEach((r) => {
      map[r.key] = r;
    });

  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    keys.push(monthKeyOf(addMonths(today, -i)));
  }

  return fill(keys, map);
};

/**
 * Yearly series for the trailing N years.
 */
const yearlySeries = (userId, years = 5, type = 'Expense') => {
  const thisYear = new Date().getFullYear();
  const start = toDateKey(new Date(thisYear - (years - 1), 0, 1));
  const end = addDaysToKey(toDateKey(new Date()), 1);

  const map = {};
  transactionModel
    .seriesBetween(userId, type, start, end, 'year')
    .forEach((r) => {
      map[r.key] = r;
    });

  const keys = [];
  for (let y = thisYear - (years - 1); y <= thisYear; y += 1) keys.push(String(y));

  return fill(keys, map);
};

const monthKeyOf = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

module.exports = {
  totalsBetween,
  categoryBreakdown,
  dailySeries,
  weeklySeries,
  monthlySeries,
  yearlySeries,
  startOfMonth,
  monthRange,
  monthKeyOf,
  round2,
};
