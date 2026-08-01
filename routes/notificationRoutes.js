const router = require('express').Router();
const { body } = require('express-validator');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { listNotifications, markNotificationsRead } = require('../controllers/notificationController');

const markReadRules = [
  body('id').optional().isInt({ min: 1 }).withMessage('id must be a positive integer.'),
];

router.get('/', authenticate, listNotifications);
router.put('/read', authenticate, validate(markReadRules), markNotificationsRead);

module.exports = router;
