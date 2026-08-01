const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { initDb } = require('./config/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();

app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const isLocalDevOrigin = (origin) => {
  if (!origin || env.nodeEnv === 'production') return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
      : false;
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      const allowed =
        !origin ||
        env.corsOrigins.includes('*') ||
        env.corsOrigins.includes(origin) ||
        isLocalDevOrigin(origin);
      if (allowed) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.use(globalLimiter);

// Real frontend (login/signup + dashboard) served from /public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'SpendSnap AI API — see /api for routes' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

const server = () => {
  initDb();
  app.listen(env.port, () => {
    console.log(`[server] SpendSnap AI API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
};

const shutdown = (signal) => {
  console.log(`\n[server] ${signal} received, shutting down gracefully...`);
  setTimeout(() => process.exit(0), 300);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

if (require.main === module) {
  try {
    server();
  } catch (err) {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  }
}

module.exports = app;
