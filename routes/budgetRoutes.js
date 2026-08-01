const router = require('express').Router();
const { body, query } = require('express-validator');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createBudget, getBudget, updateBudget } = require('../controllers/budgetController');

const budgetRules = [
  body('monthlyBudget').optional().isFloat({ min: 0 }).withMessage('monthlyBudget must be a non-negative number.'),
  body('savingGoal').optional().isFloat({ min: 0 }).withMessage('savingGoal must be a non-negative number.'),
  body('month').optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('month must be in YYYY-MM format.'),
];

const monthQuery = [
  query('month').optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('month must be in YYYY-MM format.'),
];

router.post('/', authenticate, validate(budgetRules), createBudget);
router.get('/', authenticate, validate(monthQuery), getBudget);
router.put('/', authenticate, validate(budgetRules), updateBudget);

module.exports = router;
