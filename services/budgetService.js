const budgetModel = require('../models/budgetModel');
const transactionModel = require('../models/transactionModel');
const userModel = require('../models/userModel');
const { monthRange, monthKey, round2 } = require('../utils/constants');

/**
 * Ensures a Budget row exists for the given user + month, seeding a zero
 * budget when it is missing.
 */
const ensureBudget = (userId, month = monthKey()) => budgetModel.ensure(userId, month);

/**
 * Recomputes totalSpent / remainingBudget for a user + month from the
 * actual Expense transactions. Called after every transaction create,
 * update or delete so budget numbers never drift.
 */
const recomputeTotals = (userId, month = monthKey()) => {
  const budget = ensureBudget(userId, month);
  const { start, end } = monthRange(month);

  const { total } = transactionModel.expenseTotalBetween(userId, start, end);
  const totalSpent = round2(total);
  const remainingBudget = round2(budget.monthlyBudget - totalSpent);

  budgetModel.updateTotals(budget.id, { totalSpent, remainingBudget });
  return { ...budget, totalSpent, remainingBudget };
};

/**
 * Upserts budget settings (monthlyBudget / savingGoal) for a month and keeps
 * the user-level default monthly budget in sync for future months.
 */
const upsertBudget = (userId, month, payload) => {
  const budget = ensureBudget(userId, month);

  budgetModel.updateSettings(userId, month, {
    monthlyBudget: payload.monthlyBudget !== undefined ? payload.monthlyBudget : budget.monthlyBudget,
    savingGoal: payload.savingGoal !== undefined ? payload.savingGoal : budget.savingGoal,
  });

  const updated = budgetModel.findOne(userId, month);
  const remainingBudget = round2(updated.monthlyBudget - updated.totalSpent);
  budgetModel.updateTotals(updated.id, { totalSpent: updated.totalSpent, remainingBudget });

  if (updated.monthlyBudget !== budget.monthlyBudget) {
    userModel.updateMonthlyBudget(userId, updated.monthlyBudget);
  }

  return { ...updated, remainingBudget };
};

module.exports = { ensureBudget, recomputeTotals, upsertBudget };
