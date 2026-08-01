const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { monthKey, isValidMonthKey } = require('../utils/constants');
const { ensureBudget, upsertBudget, recomputeTotals } = require('../services/budgetService');

const parseMonth = (value) => {
  if (value && !isValidMonthKey(value)) {
    throw new ApiError(400, 'month must be in YYYY-MM format.');
  }
  return value || monthKey();
};

/**
 * POST /api/budget — create (upsert) a budget for a month.
 * Body: { monthlyBudget, savingGoal, month? }
 */
const createBudget = asyncHandler(async (req, res) => {
  const month = parseMonth(req.body.month);
  const budget = upsertBudget(req.userId, month, req.body);
  return res.status(201).json({ success: true, data: budget });
});

/**
 * GET /api/budget?month=YYYY-MM  — latest budget by default.
 */
const getBudget = asyncHandler(async (req, res) => {
  const month = parseMonth(req.query.month);
  const budget = recomputeTotals(req.userId, month);
  return res.json({ success: true, data: budget });
});

/**
 * PUT /api/budget — update existing budget. Body: { monthlyBudget, savingGoal, month? }
 */
const updateBudget = asyncHandler(async (req, res) => {
  const month = parseMonth(req.body.month);

  if (req.body.monthlyBudget === undefined && req.body.savingGoal === undefined) {
    throw new ApiError(400, 'Provide monthlyBudget and/or savingGoal to update.');
  }

  const budget = upsertBudget(req.userId, month, req.body);
  return res.json({ success: true, data: budget });
});

module.exports = { createBudget, getBudget, updateBudget };
