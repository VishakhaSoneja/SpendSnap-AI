const transactionModel = require('../models/transactionModel');
const aiInsightModel = require('../models/aiInsightModel');
const budgetModel = require('../models/budgetModel');
const { monthKey, monthRange, dateKey } = require('../utils/constants');
const { categoryBreakdown, totalsBetween, monthlySeries } = require('./analyticsService');

const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Rule-based insight generator. Returns a list of candidate insights based on
 * the user's recent transactions and budget — no external AI key required.
 */
const computeInsights = (userId) => {
  const month = monthKey();
  const { start, end } = monthRange(month);
  const insights = [];

  const prevStart = new Date(start);
  prevStart.setMonth(prevStart.getMonth() - 1);

  const budget = budgetModel.findOne(userId, month);
  const expense = totalsBetween(userId, 'Expense', start, end);
  const income = totalsBetween(userId, 'Income', start, end);
  const prevExpense = totalsBetween(userId, 'Expense', prevStart, start);
  const categories = categoryBreakdown(userId, start, end, 'Expense');
  const recent = transactionModel.recent(userId, 5);

  const monthlyBudget = budget?.monthlyBudget ?? 0;

  if (monthlyBudget > 0) {
    const pct = expense.total > 0 ? (expense.total / monthlyBudget) * 100 : 0;
    if (pct >= 100) {
      insights.push({
        title: 'Budget exceeded',
        message: `You've spent ${Math.round(pct)}% of your monthly budget (₹${expense.total.toLocaleString()}). Consider pausing non-essential spending for the rest of the month.`,
        priority: 'high',
        category: 'Budget',
      });
    } else if (pct >= 90) {
      insights.push({
        title: 'Approaching budget limit',
        message: `You've used ${Math.round(pct)}% of your monthly budget with a few days still to go. Watch discretionary categories like Food and Shopping.`,
        priority: 'high',
        category: 'Budget',
      });
    } else if (pct >= 75) {
      insights.push({
        title: 'On track, keep steady',
        message: `You've used ${Math.round(pct)}% of your budget so far. Staying on this pace keeps you under the monthly limit.`,
        priority: 'medium',
        category: 'Budget',
      });
    }
  }

  if (categories.length) {
    const top = categories[0];
    if (top.percentage >= 40) {
      insights.push({
        title: 'Spending concentrated in one category',
        message: `${top.category} makes up ${top.percentage}% of your expenses (₹${top.total.toLocaleString()}). A little rebalancing here can free up noticeable cash.`,
        priority: 'high',
        category: top.category,
      });
    }
  }

  if (prevExpense.total > 0 && expense.total > prevExpense.total) {
    const growth = ((expense.total - prevExpense.total) / prevExpense.total) * 100;
    if (growth >= 30) {
      insights.push({
        title: 'Spending is rising',
        message: `Your spending is up ${Math.round(growth)}% compared to last month. Review recent transactions to spot where it's climbing.`,
        priority: 'medium',
        category: 'Overall',
      });
    }
  }

  if (income.total > 0) {
    const savingsRate = ((income.total - expense.total) / income.total) * 100;
    if (savingsRate < 0) {
      insights.push({
        title: 'Outflow exceeds income',
        message: `You spent more than you earned this month. Cutting one category — often Food or Entertainment — can bring things back in balance.`,
        priority: 'high',
        category: 'Overall',
      });
    } else if (savingsRate < 10) {
      insights.push({
        title: 'Low savings rate',
        message: `Only ${Math.round(savingsRate)}% of your income was left over this month. Aiming for 20% would add meaningful headroom.`,
        priority: 'medium',
        category: 'Savings',
      });
    } else if (savingsRate >= 20) {
      insights.push({
        title: 'Strong saving month',
        message: `You kept ${Math.round(savingsRate)}% of your income this month. Nice work — keep the momentum.`,
        priority: 'low',
        category: 'Savings',
      });
    }
  }

  if (recent.length === 0) {
    insights.push({
      title: 'No recent activity',
      message: 'Add your first transaction to start getting personalised money insights.',
      priority: 'low',
      category: 'Onboarding',
    });
  } else {
    const lastActivity = new Date(`${recent[0].date}T00:00:00`);
    const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
    if (daysSince >= 7) {
      insights.push({
        title: 'A while since your last entry',
        message: `Your last transaction was ${daysSince} days ago. Logging daily keeps your budget and insights accurate.`,
        priority: 'low',
        category: 'Engagement',
      });
    }
  }

  const prev6 = monthlySeries(userId, 6, 'Expense');
  if (prev6.length >= 2) {
    const last = prev6[prev6.length - 1];
    const avg = prev6.slice(0, -1).reduce((s, m) => s + m.total, 0) / (prev6.length - 1);
    if (avg > 0 && last.total < avg * 0.8) {
      insights.push({
        title: 'Below your spending trend',
        message: `This month is tracking below your 6-month average (${Math.round((last.total / avg) * 100)}%). Whatever you're doing — keep it up.`,
        priority: 'low',
        category: 'Overall',
      });
    }
  }

  return insights;
};

/**
 * Persists fresh insights for the day (deduplicated) and returns the newest
 * stored insights for the user.
 */
const generateInsights = (userId) => {
  const candidates = computeInsights(userId);
  const today = dateKey();

  candidates.forEach((insight) => {
    aiInsightModel.insertIfAbsent(userId, {
      ...insight,
      dedupeKey: `${today}:${slugify(insight.title)}`,
    });
  });

  return aiInsightModel.listRecent(userId, 10);
};

module.exports = { generateInsights, computeInsights };
