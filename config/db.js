const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const env = require('./env');

let db = null;

/**
 * Opens (or reuses) the SQLite connection and ensures the schema exists.
 * Synchronous — called once from server.js before the app listens.
 */
const initDb = () => {
  if (db) return db;

  const dbPath = env.dbPath === ':memory:' ? ':memory:' : path.resolve(env.dbPath);

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  const schema = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  db.exec(schema);

  console.log(`[db] SQLite ready: ${dbPath === ':memory:' ? ':memory:' : dbPath}`);
  return db;
};

const getDb = () => {
  if (!db) return initDb();
  return db;
};

const closeDb = () => {
  if (db) {
    db.close();
    db = null;
  }
};

module.exports = { initDb, getDb, closeDb };
