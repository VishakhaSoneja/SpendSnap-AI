const { getDb } = require('../config/db');
const { round2, dateKey } = require('../utils/constants');

const toKey = (value) => (value instanceof Date ? dateKey(value) : value);

const BASE_COLUMNS = `
  id,
  user_id AS userId,
  type,
  category,
  amount,
  payment_method AS paymentMethod,
  note,
  receipt,
  date,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const rowToTransaction = (row) => {
  if (!row) return null;
  return { ...row, amount: round2(row.amount || 0) };
};

const findById = (id) =>
  rowToTransaction(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM transactions WHERE id = ?`).get(id));

const findByIdForUser = (id, userId) =>
  rowToTransaction(
    getDb().prepare(`SELECT ${BASE_COLUMNS} FROM transactions WHERE id = ? AND user_id = ?`).get(id, userId)
  );

const create = ({ userId, type, category, amount, paymentMethod, note = '', receipt = '', date }) => {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO transactions (user_id, type, category, amount, payment_method, note, receipt, date, created_at, updated_at)
       VALUES (@userId, @type, @category, @amount, @paymentMethod, @note, @receipt, @date, @createdAt, @updatedAt)`
    )
    .run({ userId, type, category, amount, paymentMethod, note, receipt, date, createdAt: now, updatedAt: now });
  return findById(info.lastInsertRowid);
};

const SORT_MAP = {
  '-date': 'date DESC, id DESC',
  date: 'date ASC, id ASC',
  '-amount': 'amount DESC, id DESC',
  amount: 'amount ASC, id ASC',
  '-createdAt': 'created_at DESC, id DESC',
  createdAt: 'created_at ASC, id ASC',
};

/**
 * Lists transactions for a user with filters + free-text search + pagination.
 *
 * @param {number} userId
 * @param {Object} opts { type, category, paymentMethod, from, to, month, q, page, limit, sort }
 * @returns {{ transactions: Array, total: number }}
 */
const list = (userId, opts) => {
  const { type, category, paymentMethod, from, to, month, q, page = 1, limit = 50, sort = '-date' } = opts;

  const where = ['user_id = @userId'];
  const params = { userId };

  if (type) {
    where.push('type = @type');
    params.type = type;
  }
  if (category) {
    where.push('category = @category');
    params.category = category;
  }
  if (paymentMethod) {
    where.push('payment_method = @paymentMethod');
    params.paymentMethod = paymentMethod;
  }
  if (month) {
    where.push("substr(date, 1, 7) = @month");
    params.month = month;
  }
  if (from) {
    where.push('date >= @from');
    params.from = from;
  }
  if (to) {
    where.push('date <= @to');
    params.to = to;
  }
  if (q) {
    where.push('(note LIKE @q OR category LIKE @q OR payment_method LIKE @q OR type LIKE @q)');
    params.q = `%${q}%`;
  }

  const whereSql = where.join(' AND ');
  const orderBy = SORT_MAP[sort] || SORT_MAP['-date'];
  const offset = (page - 1) * limit;

  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM transactions WHERE ${whereSql}`)
    .get(params);

  const rows = getDb()
    .prepare(`SELECT ${BASE_COLUMNS} FROM transactions WHERE ${whereSql} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });

  return { transactions: rows.map(rowToTransaction), total };
};

const update = (id, fields) => {
  const current = findById(id);
  if (!current) return null;

  const merged = {
    type: fields.type ?? current.type,
    category: fields.category ?? current.category,
    amount: fields.amount !== undefined ? fields.amount : current.amount,
    paymentMethod: fields.paymentMethod ?? current.paymentMethod,
    note: fields.note !== undefined ? fields.note : current.note,
    receipt: fields.receipt !== undefined ? fields.receipt : current.receipt,
    date: fields.date !== undefined ? fields.date : current.date,
  };

  getDb()
    .prepare(
      `UPDATE transactions SET
        type = @type,
        category = @category,
        amount = @amount,
        payment_method = @paymentMethod,
        note = @note,
        receipt = @receipt,
        date = @date,
        updated_at = @updatedAt
       WHERE id = @id`
    )
    .run({ ...merged, id, updatedAt: new Date().toISOString() });

  return findById(id);
};

const remove = (id) => {
  const info = getDb().prepare('DELETE FROM transactions WHERE id = ?').run(id);
  return info.changes > 0;
};

const removeForUser = (id, userId) => {
  const info = getDb().prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
  return info.changes > 0;
};

/**
 * Sum + count of transactions of a type within a date range (start inclusive, end exclusive).
 * Dates are ISO "YYYY-MM-DD" strings; comparisons are lexicographic.
 */
const totalsBetween = (userId, type, start, end) => {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM transactions
       WHERE user_id = @userId AND type = @type AND date >= @start AND date < @end`
    )
    .get({ userId, type, start: toKey(start), end: toKey(end) });
  return { total: round2(row.total), count: row.count };
};

/**
 * Expense total in a month range (used by budget recompute).
 */
const expenseTotalBetween = (userId, start, end) => totalsBetween(userId, 'Expense', start, end);

/**
 * Category breakdown grouped by category, ordered by total desc.
 */
const categoryBreakdown = (userId, start, end, type = 'Expense') => {
  const rows = getDb()
    .prepare(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM transactions
       WHERE user_id = @userId AND type = @type AND date >= @start AND date < @end
       GROUP BY category
       ORDER BY total DESC`
    )
    .all({ userId, type, start: toKey(start), end: toKey(end) });
  return rows.map((r) => ({ ...r, total: round2(r.total), count: r.count }));
};

/**
 * Series grouped by day ("YYYY-MM-DD"), month ("YYYY-MM") or year ("YYYY").
 * Used by the analytics service which then zero-fills the buckets.
 */
const seriesBetween = (userId, type, start, end, period) => {
  const len = period === 'day' ? 10 : period === 'month' ? 7 : 4;
  const rows = getDb()
    .prepare(
      `SELECT substr(date, 1, ${len}) AS key, SUM(amount) AS total, COUNT(*) AS count
       FROM transactions
       WHERE user_id = @userId AND type = @type AND date >= @start AND date < @end
       GROUP BY substr(date, 1, ${len})`
    )
    .all({ userId, type, start: toKey(start), end: toKey(end) });
  return rows.map((r) => ({ key: r.key, total: round2(r.total), count: r.count }));
};

const recent = (userId, limit = 5) => {
  const rows = getDb()
    .prepare(`SELECT ${BASE_COLUMNS} FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?`)
    .all(userId, limit);
  return rows.map(rowToTransaction);
};

module.exports = {
  findById,
  findByIdForUser,
  create,
  list,
  update,
  remove,
  removeForUser,
  totalsBetween,
  expenseTotalBetween,
  categoryBreakdown,
  seriesBetween,
  recent,
};
