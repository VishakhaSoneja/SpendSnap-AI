const router = require('express').Router();
const { authLimiter } = require('../middleware/rateLimiter');
const { register, login, getProfile, updateProfile, changePassword } = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const { CURRENCIES } = require('../utils/constants');

const registerRules = [
  body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Full name must be 2-80 characters.'),
  body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 8, max: 100 }).withMessage('Password must be at least 8 characters.'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone is too long.'),
  body('currency').optional().isIn(CURRENCIES).withMessage(`currency must be one of: ${CURRENCIES.join(', ')}`),
];

const loginRules = [
  body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

const updateProfileRules = [
  body('fullName').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Full name must be 2-80 characters.'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone is too long.'),
  body('profileImage').optional().isURL().withMessage('Profile image must be a valid URL.'),
  body('currency').optional().isIn(CURRENCIES).withMessage(`currency must be one of: ${CURRENCIES.join(', ')}`),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').isLength({ min: 8, max: 100 }).withMessage('New password must be at least 8 characters.'),
];

router.post('/register', authLimiter, validate(registerRules), register);
router.post('/login', authLimiter, validate(loginRules), login);

router.get('/profile', authenticate, getProfile);
router.put('/update-profile', authenticate, validate(updateProfileRules), updateProfile);
router.put('/change-password', authenticate, validate(changePasswordRules), changePassword);

module.exports = router;
