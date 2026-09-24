const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getCurrentMonthlyReport, downloadMonthlyReport } = require('../controllers/monthlyReportController');

router.get('/current', authenticate, getCurrentMonthlyReport);
router.get('/download', authenticate, downloadMonthlyReport);

module.exports = router;
