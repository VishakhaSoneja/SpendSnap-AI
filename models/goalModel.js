const { getDb } = require('../config/db');
const { round2 } = require('../utils/constants');

const BASE_COLUMNS = `
  id,
  user_id AS userId,
  name,
  target_amount AS targetAmount,
  saved_amount AS savedAmount,
  deadline,
  category,
  status,
  note,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const rowToGoal = (row) => {
  if (!row) return null;
  const targetAmount = round2(row.targetAmount || 0);
  const savedAmount = round2(row.savedAmount || 0);
  const progressPercent =
    targetAmount > 0 ? Math.min(Math.round((savedAmount / targetAmount) * 100), 100) : 0;
  return { ...row, targetAmount, savedAmount, progressPercent, remainingAmount: round2(targetAmount - savedAmount) };
};

const list = (userId) => {
  const rows = getDb()
    .prepare(`SELECT ${BASE_COLUMNS} FROM goals WHERE user_id = ? ORDER BY created_at DESC, id DESC`)
    .all(userId);
  return rows.map(rowToGoal);
};

const findById = (id) => rowToGoal(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM goals WHERE id = ?`).get(id));

const findByIdForUser = (id, userId) =>
  rowToGoal(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM goals WHERE id = ? AND user_id = ?`).get(id, userId));

const create = ({ userId, name, targetAmount, savedAmount = 0, deadline = null, category = 'Other', status = 'active', note = '' }) => {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO goals (user_id, name, target_amount, saved_amount, deadline, category, status, note, created_at, updated_at)
       VALUES (@userId, @name, @targetAmount, @savedAmount, @deadline, @category, @status, @note, @createdAt, @updatedAt)`
    )
    .run({
      userId,
      name,
      targetAmount,
      savedAmount,
      deadline,
      category,
      status,
      note,
      createdAt: now,
      updatedAt: now,
    });
  return findById(info.lastInsertRowid);
};

const update = (id, fields) => {
  const current = findById(id);
  if (!current) return null;

  getDb()
    .prepare(
      `UPDATE goals SET
        name = @name,
        target_amount = @targetAmount,
        saved_amount = @savedAmount,
        deadline = @deadline,
        category = @category,
        status = @status,
        note = @note,
        updated_at = @updatedAt
       WHERE id = @id`
    )
    .run({
      id,
      name: fields.name ?? current.name,
      targetAmount: fields.targetAmount !== undefined ? fields.targetAmount : current.targetAmount,
      savedAmount: fields.savedAmount !== undefined ? fields.savedAmount : current.savedAmount,
      deadline: fields.deadline !== undefined ? fields.deadline : current.deadline,
      category: fields.category ?? current.category,
      status: fields.status ?? current.status,
      note: fields.note !== undefined ? fields.note : current.note,
      updatedAt: new Date().toISOString(),
    });

  return findById(id);
};

const addSavings = (id, amount) => {
  getDb()
    .prepare('UPDATE goals SET saved_amount = saved_amount + ?, updated_at = ? WHERE id = ?')
    .run(amount, new Date().toISOString(), id);
  return findById(id);
};

const remove = (id) => {
  const info = getDb().prepare('DELETE FROM goals WHERE id = ?').run(id);
  return info.changes > 0;
};

module.exports = { list, findById, findByIdForUser, create, update, addSavings, remove };
