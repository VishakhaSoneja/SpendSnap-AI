const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authorized. Please provide a Bearer token.');
  }

  const token = header.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new ApiError(401, 'Session expired or token is invalid. Please sign in again.');
  }

  const user = userModel.findById(payload.id);
  if (!user) {
    throw new ApiError(401, 'The account linked to this token no longer exists.');
  }

  req.user = user;
  req.userId = user.id;
  return next();
});

module.exports = authenticate;
