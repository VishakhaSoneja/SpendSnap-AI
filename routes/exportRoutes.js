const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { exportCsv } = require('../controllers/exportController');

router.get('/csv', authenticate, exportCsv);

module.exports = router;
