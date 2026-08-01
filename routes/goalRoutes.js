const router = require('express').Router();
const { body, param } = require('express-validator');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { GOAL_STATUSES } = require('../utils/constants');
const {
  listGoals,
  createGoal,
  getGoal,
  updateGoal,
  addSavings,
  deleteGoal,
} = require('../controllers/goalController');

const goalRules = [
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('name must be 1-80 characters.'),
  body('targetAmount').isFloat({ min: 0.01 }).withMessage('targetAmount must be a number greater than 0.'),
  body('savedAmount').optional().isFloat({ min: 0 }).withMessage('savedAmount must be a non-negative number.'),
  body('deadline').optional().isISO8601().withMessage('deadline must be a valid date.'),
  body('category').optional().trim().isLength({ max: 50 }).withMessage('category is too long.'),
  body('status').optional().isIn(GOAL_STATUSES).withMessage(`status must be one of: ${GOAL_STATUSES.join(', ')}`),
  body('note').optional().trim().isLength({ max: 200 }).withMessage('note must be at most 200 characters.'),
];

const updateGoalRules = [
  body('name').optional().trim().isLength({ min: 1, max: 80 }).withMessage('name must be 1-80 characters.'),
  body('targetAmount').optional().isFloat({ min: 0.01 }).withMessage('targetAmount must be a number greater than 0.'),
  body('savedAmount').optional().isFloat({ min: 0 }).withMessage('savedAmount must be a non-negative number.'),
  body('deadline').optional({ nullable: true }).isISO8601().withMessage('deadline must be a valid date.'),
  body('category').optional().trim().isLength({ max: 50 }).withMessage('category is too long.'),
  body('status').optional().isIn(GOAL_STATUSES).withMessage(`status must be one of: ${GOAL_STATUSES.join(', ')}`),
  body('note').optional().trim().isLength({ max: 200 }).withMessage('note must be at most 200 characters.'),
];

const addSavingsRules = [
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a number greater than 0.'),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer.')];

router.get('/', authenticate, listGoals);
router.post('/', authenticate, validate(goalRules), createGoal);
router.get('/:id', authenticate, validate(idParam), getGoal);
router.put('/:id', authenticate, validate([...idParam, ...updateGoalRules]), updateGoal);
router.patch('/:id/add-savings', authenticate, validate([...idParam, ...addSavingsRules]), addSavings);
router.delete('/:id', authenticate, validate(idParam), deleteGoal);

module.exports = router;
