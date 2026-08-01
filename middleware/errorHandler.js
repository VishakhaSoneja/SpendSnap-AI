const env = require('../config/env');

const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors;

  // SQLite constraint violation (e.g. duplicate email / dedupe key)
  if (err.code && err.code.startsWith('SQLITE')) {
    statusCode = err.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400;
    message =
      err.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ? 'A record with those details already exists.'
        : 'A database constraint was violated.';
  }

  // Operational errors are logged lightly; unexpected errors log full stack.
  if (statusCode >= 500 && !err.isOperational) {
    console.error('[error]', err);
  }

  const body = { success: false, message };
  if (errors && errors.length) body.errors = errors;

  if (env.nodeEnv === 'development' && statusCode >= 500) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
