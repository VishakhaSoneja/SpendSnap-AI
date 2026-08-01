const { getDb } = require('../config/db');
const { round2 } = require('../utils/constants');

const BASE_COLUMNS = `
  id,
  user_id AS userId,
  month,
  monthly_budget AS monthlyBudget,
  total_spent AS totalSpent,
  remaining_budget AS remainingBudget,
  saving_goal AS savingGoal,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const rowToBudget = (row) => {
  if (!row) return null;
  return {
    ...row,
    monthlyBudget: round2(row.monthlyBudget || 0),
    totalSpent: round2(row.totalSpent || 0),
    remainingBudget: round2(row.remainingBudget || 0),
    savingGoal: round2(row.savingGoal || 0),
  };
};

const findOne = (userId, month) =>
  rowToBudget(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM budgets WHERE user_id = ? AND month = ?`).get(userId, month));

/**
 * Inserts a default budget row for a user + month if it does not exist.
 */
const ensure = (userId, month) => {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO budgets (user_id, month, monthly_budget, total_spent, remaining_budget, saving_goal, created_at, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, ?, ?)`
    )
    .run(userId, month, now, now);
  return findOne(userId, month);
};

const updateTotals = (id, { totalSpent, remainingBudget }) => {
  getDb()
    .prepare('UPDATE budgets SET total_spent = ?, remaining_budget = ?, updated_at = ? WHERE id = ?')
    .run(totalSpent, remainingBudget, new Date().toISOString(), id);
};

const updateSettings = (userId, month, { monthlyBudget, savingGoal }) => {
  getDb()
    .prepare(
      `UPDATE budgets SET
        monthly_budget = COALESCE(@monthlyBudget, monthly_budget),
        saving_goal = COALESCE(@savingGoal, saving_goal),
        updated_at = @updatedAt
       WHERE user_id = @userId AND month = @month`
    )
    .run({
      userId,
      month,
      monthlyBudget: monthlyBudget !== undefined ? monthlyBudget : null,
      savingGoal: savingGoal !== undefined ? savingGoal : null,
      updatedAt: new Date().toISOString(),
    });
  return findOne(userId, month);
};

module.exports = { findOne, ensure, updateTotals, updateSettings };
