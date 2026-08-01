const router = require('express').Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'SpendSnap AI API is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', require('./authRoutes'));
router.use('/transactions', require('./transactionRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/analytics', require('./analyticsRoutes'));
router.use('/budget', require('./budgetRoutes'));
router.use('/goals', require('./goalRoutes'));
router.use('/ai', require('./aiRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/export', require('./exportRoutes'));

module.exports = router;
