const { getDb } = require('../config/db');
const { round2 } = require('../utils/constants');

const BASE_COLUMNS = `
  id,
  full_name AS fullName,
  email,
  phone,
  profile_image AS profileImage,
  currency,
  monthly_budget AS monthlyBudget,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const rowToUser = (row) => {
  if (!row) return null;
  return { ...row, monthlyBudget: round2(row.monthlyBudget || 0) };
};

const findById = (id) => rowToUser(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM users WHERE id = ?`).get(id));

const findByIdWithPassword = (id) =>
  getDb()
    .prepare(
      `SELECT id, full_name AS fullName, email, phone, profile_image AS profileImage,
              currency, monthly_budget AS monthlyBudget, password, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ?`
    )
    .get(id);

const findByEmail = (email) => rowToUser(getDb().prepare(`SELECT ${BASE_COLUMNS} FROM users WHERE email = ?`).get(email));

const findByEmailWithPassword = (email) =>
  getDb()
    .prepare(
      `SELECT id, full_name AS fullName, email, phone, profile_image AS profileImage,
              currency, monthly_budget AS monthlyBudget, password, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE email = ?`
    )
    .get(email);

const create = ({ fullName, email, phone = '', password, currency = 'INR' }) => {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO users (full_name, email, phone, password, currency, created_at, updated_at)
       VALUES (@fullName, @email, @phone, @password, @currency, @createdAt, @updatedAt)`
    )
    .run({ fullName, email: email.toLowerCase(), phone, password, currency, createdAt: now, updatedAt: now });
  return findById(info.lastInsertRowid);
};

const updateProfile = (id, fields) => {
  const { fullName, phone, profileImage, currency } = fields;
  getDb()
    .prepare(
      `UPDATE users SET
        full_name = COALESCE(@fullName, full_name),
        phone = COALESCE(@phone, phone),
        profile_image = COALESCE(@profileImage, profile_image),
        currency = COALESCE(@currency, currency),
        updated_at = @updatedAt
       WHERE id = @id`
    )
    .run({
      id,
      fullName: fullName ?? null,
      phone: phone ?? null,
      profileImage: profileImage ?? null,
      currency: currency ?? null,
      updatedAt: new Date().toISOString(),
    });
  return findById(id);
};

const updatePassword = (id, password) => {
  getDb()
    .prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
    .run(password, new Date().toISOString(), id);
  return findById(id);
};

const updateMonthlyBudget = (id, monthlyBudget) => {
  getDb()
    .prepare('UPDATE users SET monthly_budget = ?, updated_at = ? WHERE id = ?')
    .run(monthlyBudget, new Date().toISOString(), id);
  return findById(id);
};

/**
 * Strips sensitive fields before sending a user to the client.
 */
const toSafeJSON = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

module.exports = {
  findById,
  findByIdWithPassword,
  findByEmail,
  findByEmailWithPassword,
  create,
  updateProfile,
  updatePassword,
  updateMonthlyBudget,
  toSafeJSON,
};
