const { getDb } = require('../config/db');

const BASE_COLUMNS = `
  id,
  user_id AS userId,
  title,
  message,
  priority,
  category,
  created_at AS createdAt
`;

const rowToInsight = (row) => (row ? { ...row, id: Number(row.id) } : null);

const insertIfAbsent = (userId, { title, message, priority, category, dedupeKey }) => {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO ai_insights (user_id, title, message, priority, category, dedupe_key, created_at)
       VALUES (@userId, @title, @message, @priority, @category, @dedupeKey, @createdAt)`
    )
    .run({ userId, title, message, priority, category, dedupeKey, createdAt: new Date().toISOString() });
};

const listRecent = (userId, limit = 10) => {
  const rows = getDb()
    .prepare(`SELECT ${BASE_COLUMNS} FROM ai_insights WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(userId, limit);
  return rows.map(rowToInsight);
};

module.exports = { insertIfAbsent, listRecent };
