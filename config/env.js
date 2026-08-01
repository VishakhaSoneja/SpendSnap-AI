const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const required = ['JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env and set the values.'
  );
  process.exit(1);
}

const parseOrigins = (raw) =>
  String(raw || '')
    .split(/[,\s]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);

const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '..', 'data', 'spendsnap.sqlite'),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  isProduction: process.env.NODE_ENV === 'production',
  corsOrigins: parseOrigins(
    process.env.CORS_ORIGINS ||
      (process.env.NODE_ENV === 'production'
        ? ''
        : 'http://localhost:5000,http://127.0.0.1:5000,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173')
  ),
  rateLimitWindowMin: parseInt(process.env.RATE_LIMIT_WINDOW_MIN, 10) || 15,
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 300,
  authRateLimitMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 20,
};

module.exports = env;
