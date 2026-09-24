const { getDb } = require('../config/db');
const budgetModel = require('../models/budgetModel');
const goalModel = require('../models/goalModel');
const transactionModel = require('../models/transactionModel');
const { monthKey, monthRange, round2 } = require('../utils/constants');
const { totalsBetween, categoryBreakdown } = require('./analyticsService');
const { buildCsv } = require('../exports/csvExport');

const monthName = (monthKeyValue) => {
  if (!monthKeyValue || !/^\d{4}-\d{2}$/.test(monthKeyValue)) return 'Month';
  const [year, month] = monthKeyValue.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const getReportMonthForDate = (date = new Date()) => {
  const currentKey = monthKey(date);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const currentDay = date.getDate();

  if (currentDay === lastDay) {
    return { month: currentKey, isEligible: true, due: true, kind: 'current' };
  }

  if (currentDay === 1) {
    const previousMonth = monthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
    return { month: previousMonth, isEligible: true, due: true, kind: 'previous' };
  }

  return { month: currentKey, isEligible: false, due: false, kind: 'current' };
};

const getGoalForMonth = (userId, month) => {
  const goals = goalModel.list(userId);
  const relevantGoal = goals.find((goal) => goal.deadline && goal.deadline.startsWith(month))
    || goals.find((goal) => goal.status === 'active')
    || goals[0]
    || null;

  return relevantGoal
    ? {
        id: relevantGoal.id,
        name: relevantGoal.name,
        targetAmount: relevantGoal.targetAmount,
        savedAmount: relevantGoal.savedAmount,
        progressPercent: relevantGoal.progressPercent,
        status: relevantGoal.status,
      }
    : null;
};

const buildMonthlyCsvRows = (userId, month, transactions, budget, goal) =>
  transactions.map((tx) => ({
    date: tx.date,
    transactionType: tx.type,
    category: tx.category,
    description: tx.note || '',
    amount: tx.amount,
    income: tx.type === 'Income' ? tx.amount : 0,
    expense: tx.type === 'Expense' ? tx.amount : 0,
    investment: tx.type === 'Investment' ? tx.amount : 0,
    paymentMethod: tx.paymentMethod,
    receipt: tx.receipt || '',
    transactionId: tx.id,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    budgetMonth: month,
    monthlyBudget: budget.monthlyBudget || 0,
    totalBudgetUsed: budget.totalSpent || 0,
    remainingBudget: budget.remainingBudget || 0,
    savingsGoal: budget.savingGoal || 0,
    goalProgress: goal ? goal.progressPercent : 0,
    goalName: goal ? goal.name : '',
    goalTargetAmount: goal ? goal.targetAmount : 0,
    goalSavedAmount: goal ? goal.savedAmount : 0,
  }));

const buildMonthlyReport = (userId, month) => {
  const { start, end } = monthRange(month);
  const income = totalsBetween(userId, 'Income', start, end);
  const expenses = totalsBetween(userId, 'Expense', start, end);
  const investments = totalsBetween(userId, 'Investment', start, end);
  const categories = categoryBreakdown(userId, start, end, 'Expense');
  const budget = budgetModel.findOne(userId, month) || {
    monthlyBudget: 0,
    totalSpent: 0,
    remainingBudget: 0,
    savingGoal: 0,
  };
  const transactions = transactionModel.list(userId, {
    month,
    page: 1,
    limit: 5000,
    sort: '-date',
  }).transactions;
  const goal = getGoalForMonth(userId, month);
  const totalSavings = round2(income.total - expenses.total);
  const topCategories = categories.slice(0, 4).map((item) => ({
    category: item.category,
    total: round2(item.total),
    count: item.count,
    percentage: item.percentage,
  }));
  const summary = {
    month,
    monthLabel: monthName(month),
    title: `Your ${monthName(month)} journey is complete! ✨`,
    message: 'Your complete monthly SpendSnap report is ready.',
    totalIncome: round2(income.total),
    totalExpenses: round2(expenses.total),
    totalSavings,
    totalInvestments: round2(investments.total),
    totalBudget: round2(budget.monthlyBudget || 0),
    totalBudgetUsed: round2(budget.totalSpent || 0),
    remainingBudget: round2(budget.remainingBudget || 0),
    savingsGoal: round2(budget.savingGoal || 0),
    goalProgress: goal ? goal.progressPercent : 0,
    goalName: goal ? goal.name : '',
    goalTargetAmount: goal ? goal.targetAmount : 0,
    goalSavedAmount: goal ? goal.savedAmount : 0,
    totalTransactions: transactions.length,
    topCategories,
    mainSpendingCategories: topCategories.length
      ? topCategories.map((item) => `${item.category} (${item.total})`).join(', ')
      : 'No spending recorded',
    budgetUsedPercent: budget.monthlyBudget > 0 ? Math.min(Math.round((budget.totalSpent / budget.monthlyBudget) * 100), 100) : 0,
    financialSummary: [
      `Income: ${round2(income.total)}`,
      `Expenses: ${round2(expenses.total)}`,
      `Savings: ${totalSavings}`,
      `Investments: ${round2(investments.total)}`,
      `Transactions: ${transactions.length}`,
    ].join(' • '),
  };

  const csvFields = [
    { label: 'Date', value: 'date' },
    { label: 'Transaction Type', value: 'transactionType' },
    { label: 'Category', value: 'category' },
    { label: 'Description', value: 'description' },
    { label: 'Amount', value: 'amount' },
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Investment', value: 'investment' },
    { label: 'Payment Method', value: 'paymentMethod' },
    { label: 'Receipt', value: 'receipt' },
    { label: 'Transaction ID', value: 'transactionId' },
    { label: 'Created At', value: 'createdAt' },
    { label: 'Updated At', value: 'updatedAt' },
    { label: 'Budget Month', value: 'budgetMonth' },
    { label: 'Monthly Budget', value: 'monthlyBudget' },
    { label: 'Total Budget Used', value: 'totalBudgetUsed' },
    { label: 'Remaining Budget', value: 'remainingBudget' },
    { label: 'Savings Goal', value: 'savingsGoal' },
    { label: 'Goal Name', value: 'goalName' },
    { label: 'Goal Target Amount', value: 'goalTargetAmount' },
    { label: 'Goal Saved Amount', value: 'goalSavedAmount' },
    { label: 'Goal Progress', value: 'goalProgress' },
  ];

  const csvData = buildCsv(buildMonthlyCsvRows(userId, month, transactions, budget, goal), csvFields);
  return { ...summary, csvData };
};

const ensureReportRecord = (userId, month, report) => {
  const payload = JSON.stringify(report);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO monthly_reports (
        user_id, month, title, summary, csv_data,
        total_income, total_expenses, total_savings, total_investments,
        total_budget, total_budget_used, remaining_budget, savings_goal,
        goal_progress, total_transactions, top_categories, generated_at
      ) VALUES (@userId, @month, @title, @summary, @csvData,
        @totalIncome, @totalExpenses, @totalSavings, @totalInvestments,
        @totalBudget, @totalBudgetUsed, @remainingBudget, @savingsGoal,
        @goalProgress, @totalTransactions, @topCategories, @generatedAt)
      ON CONFLICT(user_id, month) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        csv_data = excluded.csv_data,
        total_income = excluded.total_income,
        total_expenses = excluded.total_expenses,
        total_savings = excluded.total_savings,
        total_investments = excluded.total_investments,
        total_budget = excluded.total_budget,
        total_budget_used = excluded.total_budget_used,
        remaining_budget = excluded.remaining_budget,
        savings_goal = excluded.savings_goal,
        goal_progress = excluded.goal_progress,
        total_transactions = excluded.total_transactions,
        top_categories = excluded.top_categories,
        generated_at = excluded.generated_at`
    )
    .run({
      userId,
      month,
      title: report.title,
      summary: payload,
      csvData: report.csvData,
      totalIncome: report.totalIncome,
      totalExpenses: report.totalExpenses,
      totalSavings: report.totalSavings,
      totalInvestments: report.totalInvestments,
      totalBudget: report.totalBudget,
      totalBudgetUsed: report.totalBudgetUsed,
      remainingBudget: report.remainingBudget,
      savingsGoal: report.savingsGoal,
      goalProgress: report.goalProgress,
      totalTransactions: report.totalTransactions,
      topCategories: JSON.stringify(report.topCategories),
      generatedAt: now,
    });
};

const readStoredReport = (userId, month) => {
  const row = getDb()
    .prepare(
      `SELECT
        month, title, summary, csv_data AS csvData,
        total_income AS totalIncome, total_expenses AS totalExpenses,
        total_savings AS totalSavings, total_investments AS totalInvestments,
        total_budget AS totalBudget, total_budget_used AS totalBudgetUsed,
        remaining_budget AS remainingBudget, savings_goal AS savingsGoal,
        goal_progress AS goalProgress, total_transactions AS totalTransactions,
        top_categories AS topCategories, generated_at AS generatedAt
       FROM monthly_reports WHERE user_id = ? AND month = ?`
    )
    .get(userId, month);

  if (!row) return null;

  try {
    return {
      ...row,
      summary: JSON.parse(row.summary),
      topCategories: JSON.parse(row.topCategories || '[]'),
    };
  } catch {
    return null;
  }
};

const getOrCreateMonthlyReport = (userId, month) => {
  const existing = readStoredReport(userId, month);
  if (existing) return existing.summary;

  const generated = buildMonthlyReport(userId, month);
  ensureReportRecord(userId, month, generated);
  return generated;
};

const getReportStateForUser = (userId, date = new Date()) => {
  const info = getReportMonthForDate(date);
  if (!info.isEligible) {
    return {
      month: info.month,
      isEligible: false,
      report: null,
      shouldShow: false,
      nextMonth: monthKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)),
      due: false,
    };
  }

  const report = getOrCreateMonthlyReport(userId, info.month);
  return {
    month: info.month,
    isEligible: true,
    report,
    shouldShow: true,
    nextMonth: monthKey(new Date(new Date(info.month + '-01T00:00:00').getFullYear(), new Date(info.month + '-01T00:00:00').getMonth() + 1, 1)),
    due: info.due,
  };
};

module.exports = {
  monthName,
  getReportMonthForDate,
  getOrCreateMonthlyReport,
  getReportStateForUser,
};
