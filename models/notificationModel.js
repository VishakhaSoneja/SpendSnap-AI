const { getDb } = require('../config/db');

const BASE_COLUMNS = `
  id,
  user_id AS userId,
  title,
  message,
  type,
  is_read AS isRead,
  created_at AS createdAt
`;

const rowToNotification = (row) => (row ? { ...row, isRead: Boolean(row.isRead) } : null);

const create = (userId, { title, message, type = 'info' }) => {
  const info = getDb()
    .prepare(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, title, message, type, new Date().toISOString());
  return rowToNotification(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM notifications WHERE id = ?`).get(info.lastInsertRowid));
};

const list = (userId, { limit = 20, offset = 0, unreadOnly = false } = {}) => {
  const where = ['user_id = ?'];
  const params = [userId];
  if (unreadOnly) {
    where.push('is_read = 0');
  }
  const whereSql = where.join(' AND ');
  const rows = getDb()
    .prepare(`SELECT ${BASE_COLUMNS} FROM notifications WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return rows.map(rowToNotification);
};

const count = (userId, { unreadOnly = false } = {}) => {
  const where = ['user_id = ?'];
  const params = [userId];
  if (unreadOnly) where.push('is_read = 0');
  const { total } = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM notifications WHERE ${where.join(' AND ')}`)
    .get(...params);
  return total;
};

const countUnread = (userId) => count(userId, { unreadOnly: true });

/**
 * Marks notifications as read. Pass id to mark one, otherwise marks all.
 * @returns {number} number of rows updated
 */
const markRead = (userId, id = null) => {
  if (id) {
    const info = getDb()
      .prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ? AND is_read = 0')
      .run(userId, id);
    return info.changes;
  }
  const info = getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
  return info.changes;
};

module.exports = { create, list, count, countUnread, markRead };
