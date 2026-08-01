const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');
const { ensureBudget } = require('../services/budgetService');
const { monthKey } = require('../utils/constants');

const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const buildAuthResponse = (user) => ({
  user: userModel.toSafeJSON(user),
  token: generateToken(user),
});

const hashPassword = (password) => bcrypt.hash(password, 10);

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, currency } = req.body;

  const existing = userModel.findByEmail(email.toLowerCase());
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists. Please sign in.');
  }

  const user = userModel.create({
    fullName,
    email,
    phone: phone || '',
    password: await hashPassword(password),
    currency: currency || 'INR',
  });

  ensureBudget(user.id, monthKey());
  createNotification(user.id, {
    title: 'Welcome to SpendSnap AI 👋',
    message: 'Your account is ready. Add your first expense to start tracking.',
    type: 'success',
  });

  return res.status(201).json({ success: true, data: buildAuthResponse(user) });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = userModel.findByEmailWithPassword(email.toLowerCase());
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  ensureBudget(user.id, monthKey());

  return res.json({ success: true, data: buildAuthResponse(user) });
});

/**
 * GET /api/auth/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  return res.json({ success: true, data: req.user });
});

/**
 * PUT /api/auth/update-profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, profileImage, currency } = req.body;

  const updated = userModel.updateProfile(req.userId, { fullName, phone, profileImage, currency });
  return res.json({ success: true, data: userModel.toSafeJSON(updated) });
});

/**
 * PUT /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = userModel.findByIdWithPassword(req.userId);
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect.');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from the current password.');
  }

  userModel.updatePassword(req.userId, await hashPassword(newPassword));

  return res.json({ success: true, message: 'Password updated successfully.' });
});

module.exports = { register, login, getProfile, updateProfile, changePassword };
