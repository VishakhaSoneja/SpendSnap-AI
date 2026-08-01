const transactionModel = require('../models/transactionModel');
const asyncHandler = require('../utils/asyncHandler');
const { monthKey, monthRange } = require('../utils/constants');
const { totalsBetween, categoryBreakdown, monthlySeries } = require('../services/analyticsService');
const { ensureBudget } = require('../services/budgetService');

/**
 * GET /api/dashboard
 * Returns the full overview shown on the dashboard screen.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const month = monthKey();
  const { start, end } = monthRange(month);

  const income = totalsBetween(userId, 'Income', start, end);
  const expense = totalsBetween(userId, 'Expense', start, end);
  const investment = totalsBetween(userId, 'Investment', start, end);
  const categories = categoryBreakdown(userId, start, end, 'Expense');
  const investmentCategories = categoryBreakdown(userId, start, end, 'Investment');
  const recent = transactionModel.recent(userId, 5);
  const budget = ensureBudget(userId, month);

  const totalIncome = income.total;
  const totalExpense = expense.total;
  const totalInvestment = investment.total;
  const totalBalance = Math.round((totalIncome - totalExpense - totalInvestment) * 100) / 100;

  const monthlySummary = monthlySeries(userId, 6, 'Expense').map((s) => {
    const { start: sStart, end: sEnd } = monthRange(s.key);
    const inc = totalsBetween(userId, 'Income', sStart, sEnd);
    return { month: s.key, income: inc.total, expense: s.total };
  });

  return res.json({
    success: true,
    data: {
      month,
      totalBalance,
      totalIncome,
      totalExpense,
      totalInvestment,
      remainingBudget: budget.remainingBudget,
      monthlyBudget: budget.monthlyBudget,
      savingGoal: budget.savingGoal,
      budgetSpentPercent:
        budget.monthlyBudget > 0 ? Math.round((budget.totalSpent / budget.monthlyBudget) * 100) : 0,
      recentTransactions: recent,
      expenseCategories: categories,
      investmentCategories,
      monthlySummary,
    },
  });
});

module.exports = { getDashboard };
