const transactionModel = require('../models/transactionModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recomputeTotals } = require('../services/budgetService');
const { createNotification } = require('../services/notificationService');
const { dateKey, monthKey } = require('../utils/constants');

const getAffectedMonth = (dateValue) => {
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}$/.test(dateValue)) return dateValue;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return monthKey();
  return monthKey(d);
};

const parseFilters = (query) => {
  const {
    type,
    category,
    paymentMethod,
    from,
    to,
    month,
    q,
    limit = 50,
    page = 1,
    sort = '-date',
  } = query;

  const allowedSorts = new Set(['-date', 'date', '-amount', 'amount', '-createdAt', 'createdAt']);

  return {
    type,
    category,
    paymentMethod,
    from: from ? dateKey(new Date(from)) : undefined,
    to: to ? dateKey(new Date(to)) : undefined,
    month,
    q,
    page: Math.max(parseInt(page, 10) || 1, 1),
    limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100),
    sort: allowedSorts.has(sort) ? sort : '-date',
  };
};

/**
 * POST /api/transactions
 */
const createTransaction = asyncHandler(async (req, res) => {
  const { type, category, amount, paymentMethod, note, receipt, date } = req.body;
  const userId = req.userId;

  const transaction = transactionModel.create({
    userId,
    type,
    category,
    amount,
    paymentMethod: paymentMethod || 'Other',
    note: note || '',
    receipt: req.file ? `/uploads/receipts/${req.file.filename}` : receipt || '',
    date: date ? dateKey(new Date(date)) : dateKey(),
  });

  const month = getAffectedMonth(transaction.date);
  const budget = recomputeTotals(userId, month);

  if (type === 'Expense') {
    createNotification(userId, {
      title: 'Expense logged',
      message: `₹${Number(amount).toLocaleString()} on ${category} — ${budget.remainingBudget.toLocaleString()} left in your budget.`,
      type: budget.remainingBudget < 0 ? 'danger' : 'info',
    });
  }

  return res.status(201).json({ success: true, data: transaction });
});

/**
 * GET /api/transactions?type=&category=&paymentMethod=&from=&to=&month=&q=&page=&limit=&sort=
 * Supports search (`q`) and all list filters.
 */
const listTransactions = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);

  const { transactions, total } = transactionModel.list(req.userId, filters);

  return res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    },
  });
});

/**
 * GET /api/transactions/:id
 */
const getTransaction = asyncHandler(async (req, res) => {
  const transaction = transactionModel.findByIdForUser(req.params.id, req.userId);
  if (!transaction) throw new ApiError(404, 'Transaction not found.');
  return res.json({ success: true, data: transaction });
});

/**
 * PUT /api/transactions/:id
 */
const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = transactionModel.findByIdForUser(req.params.id, req.userId);
  if (!transaction) throw new ApiError(404, 'Transaction not found.');

  const originalMonth = getAffectedMonth(transaction.date);
  const { type, category, amount, paymentMethod, note, receipt, date } = req.body;

  const updated = transactionModel.update(transaction.id, {
    type,
    category,
    amount: amount !== undefined ? amount : transaction.amount,
    paymentMethod,
    note,
    receipt: req.file ? `/uploads/receipts/${req.file.filename}` : receipt,
    date: date !== undefined ? dateKey(new Date(date)) : transaction.date,
  });

  // Recompute totals for both the old and the new month.
  const newMonth = getAffectedMonth(updated.date);
  recomputeTotals(req.userId, originalMonth);
  recomputeTotals(req.userId, newMonth);

  return res.json({ success: true, data: updated });
});

/**
 * DELETE /api/transactions/:id
 */
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = transactionModel.findByIdForUser(req.params.id, req.userId);
  if (!transaction) throw new ApiError(404, 'Transaction not found.');

  transactionModel.removeForUser(transaction.id, req.userId);
  recomputeTotals(req.userId, getAffectedMonth(transaction.date));

  return res.json({ success: true, message: 'Transaction deleted.', data: { id: transaction.id } });
});

module.exports = { createTransaction, listTransactions, getTransaction, updateTransaction, deleteTransaction };
