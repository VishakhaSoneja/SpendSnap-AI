const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { daily, weekly, monthly, yearly } = require('../controllers/analyticsController');

router.get('/daily', authenticate, daily);
router.get('/weekly', authenticate, weekly);
router.get('/monthly', authenticate, monthly);
router.get('/yearly', authenticate, yearly);

module.exports = router;
