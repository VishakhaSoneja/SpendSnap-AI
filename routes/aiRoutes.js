const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getInsights } = require('../controllers/aiController');

router.get('/insights', authenticate, getInsights);

module.exports = router;
