const router = require('express').Router();
const { body, param } = require('express-validator');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { TRANSACTION_TYPES, CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES, ASSET_TYPES, PAYMENT_METHODS } = require('../utils/constants');
const {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');

const validCategoryForType = (value, { req }) => {
  const type = req.body.type;
  const list =
    type === 'Expense' ? EXPENSE_CATEGORIES : type === 'Income' ? INCOME_CATEGORIES : type === 'Investment' ? ASSET_TYPES : CATEGORIES;
  if (!list.includes(value)) {
    throw new Error(`category for ${type || 'this'} type must be one of: ${list.join(', ')}`);
  }
  return true;
};

const transactionRules = [
  body('type').isIn(TRANSACTION_TYPES).withMessage(`type must be one of: ${TRANSACTION_TYPES.join(', ')}`),
  body('category').custom(validCategoryForType),
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a number greater than 0.'),
  body('paymentMethod')
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('date').optional().isISO8601().withMessage('date must be a valid date (YYYY-MM-DD).'),
  body('note').optional().trim().isLength({ max: 200 }).withMessage('note must be at most 200 characters.'),
  body('receipt').optional().isString().withMessage('receipt must be a string.'),
];

const updateTransactionRules = [
  body('type')
    .optional()
    .isIn(TRANSACTION_TYPES)
    .withMessage(`type must be one of: ${TRANSACTION_TYPES.join(', ')}`),
  body('category')
    .optional()
    .custom((value, { req }) => {
      if (!req.body.type) return true;
      return validCategoryForType(value, { req });
    })
    .withMessage('category must be one of the allowed values for this type.'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('amount must be a number greater than 0.'),
  body('paymentMethod')
    .optional()
    .isIn(PAYMENT_METHODS)
    .withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('date').optional().isISO8601().withMessage('date must be a valid date (YYYY-MM-DD).'),
  body('note').optional().trim().isLength({ max: 200 }).withMessage('note must be at most 200 characters.'),
  body('receipt').optional().isString().withMessage('receipt must be a string.'),
];

const idParam = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer.')];

router.post('/', authenticate, upload.single('receipt'), validate(transactionRules), createTransaction);
router.get('/', authenticate, listTransactions);
router.get('/:id', authenticate, validate(idParam), getTransaction);
router.put('/:id', authenticate, upload.single('receipt'), validate([...idParam, ...updateTransactionRules]), updateTransaction);
router.delete('/:id', authenticate, validate(idParam), deleteTransaction);

module.exports = router;
