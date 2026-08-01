const goalModel = require('../models/goalModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');

const getOwnedGoal = (id, userId) => {
  const goal = goalModel.findByIdForUser(id, userId);
  if (!goal) throw new ApiError(404, 'Goal not found.');
  return goal;
};

/**
 * GET /api/goals — list the user's savings goals with progress.
 */
const listGoals = asyncHandler(async (req, res) => {
  const goals = goalModel.list(req.userId);
  return res.json({ success: true, data: goals });
});

/**
 * POST /api/goals
 * Body: { name, targetAmount, savedAmount?, deadline?, category?, note? }
 */
const createGoal = asyncHandler(async (req, res) => {
  const { name, targetAmount, savedAmount, deadline, category, note } = req.body;

  const goal = goalModel.create({
    userId: req.userId,
    name,
    targetAmount,
    savedAmount: savedAmount || 0,
    deadline: deadline || null,
    category: category || 'Other',
    note: note || '',
  });

  createNotification(req.userId, {
    title: 'New savings goal',
    message: `You're saving ₹${Number(targetAmount).toLocaleString()} for "${name}". Keep at it!`,
    type: 'success',
  });

  return res.status(201).json({ success: true, data: goal });
});

/**
 * GET /api/goals/:id
 */
const getGoal = asyncHandler(async (req, res) => {
  return res.json({ success: true, data: getOwnedGoal(req.params.id, req.userId) });
});

/**
 * PUT /api/goals/:id — edit goal details.
 */
const updateGoal = asyncHandler(async (req, res) => {
  const goal = getOwnedGoal(req.params.id, req.userId);

  const { name, targetAmount, savedAmount, deadline, category, status, note } = req.body;
  const updated = goalModel.update(goal.id, {
    name,
    targetAmount,
    savedAmount,
    deadline,
    category,
    status,
    note,
  });

  return res.json({ success: true, data: updated });
});

/**
 * PATCH /api/goals/:id/add-savings
 * Body: { amount } — adds to savedAmount, marks achieved when complete.
 */
const addSavings = asyncHandler(async (req, res) => {
  const goal = getOwnedGoal(req.params.id, req.userId);
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'amount must be a positive number.');
  }

  const newSaved = Math.min(goal.savedAmount + amount, goal.targetAmount);
  let updated = goalModel.update(goal.id, {
    savedAmount: newSaved,
    status: newSaved >= goal.targetAmount ? 'achieved' : goal.status,
  });

  if (newSaved >= goal.targetAmount) {
    createNotification(req.userId, {
      title: 'Goal achieved 🎉',
      message: `You reached your savings goal for "${goal.name}". Incredible work!`,
      type: 'success',
    });
  }

  return res.json({ success: true, data: updated });
});

/**
 * DELETE /api/goals/:id
 */
const deleteGoal = asyncHandler(async (req, res) => {
  const goal = getOwnedGoal(req.params.id, req.userId);
  goalModel.remove(goal.id);
  return res.json({ success: true, message: 'Goal deleted.', data: { id: goal.id } });
});

module.exports = { listGoals, createGoal, getGoal, updateGoal, addSavings, deleteGoal };
