const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { TRANSACTION_TYPES } = require('../utils/constants');
const {
  dailySeries,
  weeklySeries,
  monthlySeries,
  yearlySeries,
} = require('../services/analyticsService');

const parseType = (value) => {
  if (value === undefined || value === '') return undefined;
  if (!TRANSACTION_TYPES.includes(value)) {
    throw new ApiError(400, `type must be one of: ${TRANSACTION_TYPES.join(', ')}`);
  }
  return value;
};

const parseRange = (query) => {
  const { from, to } = query;
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'from/to must be valid dates (YYYY-MM-DD).');
  }
  if (start > end) {
    throw new ApiError(400, 'from must be earlier than to.');
  }
  return { start, end };
};

/**
 * GET /api/analytics/daily?from=&to=&type=
 */
const daily = asyncHandler(async (req, res) => {
  const type = parseType(req.query.type);
  const { start, end } = parseRange(req.query);
  const series = dailySeries(req.userId, start, end, type);
  return res.json({ success: true, data: { from: start, to: end, type: type || 'All', series } });
});

/**
 * GET /api/analytics/weekly?weeks=&type=
 */
const weekly = asyncHandler(async (req, res) => {
  const type = parseType(req.query.type);
  const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 8, 2), 26);
  const series = weeklySeries(req.userId, weeks, type);
  return res.json({ success: true, data: { weeks, type: type || 'All', series } });
});

/**
 * GET /api/analytics/monthly?months=&type=
 */
const monthly = asyncHandler(async (req, res) => {
  const type = parseType(req.query.type);
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 2), 24);
  const series = monthlySeries(req.userId, months, type);
  return res.json({ success: true, data: { months, type: type || 'All', series } });
});

/**
 * GET /api/analytics/yearly?years=&type=
 */
const yearly = asyncHandler(async (req, res) => {
  const type = parseType(req.query.type);
  const years = Math.min(Math.max(parseInt(req.query.years, 10) || 5, 2), 10);
  const series = yearlySeries(req.userId, years, type);
  return res.json({ success: true, data: { years, type: type || 'All', series } });
});

module.exports = { daily, weekly, monthly, yearly, parseRange };
