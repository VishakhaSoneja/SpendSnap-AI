const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getDashboard } = require('../controllers/dashboardController');

router.get('/', authenticate, getDashboard);

module.exports = router;
