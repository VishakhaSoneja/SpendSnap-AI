/**
 * Seeds the SQLite database with a demo user, transactions, budget, goal,
 * insights and notifications. Run: npm run seed
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
process.env.NODE_ENV = 'development';

const bcrypt = require('bcryptjs');
const { initDb } = require('../config/db');
const userModel = require('../models/userModel');
const transactionModel = require('../models/transactionModel');
const budgetModel = require('../models/budgetModel');
const goalModel = require('../models/goalModel');
const notificationModel = require('../models/notificationModel');
const aiService = require('../services/aiService');
const { dateKey, monthKey } = require('../utils/constants');

const DAY = 86400000;

const main = () => {
  initDb();

  let user = userModel.findByEmail('demo@spendsnap.com');
  if (!user) {
    user = userModel.create({
      fullName: 'Demo User',
      email: 'demo@spendsnap.com',
      password: bcrypt.hashSync('demo12345', 10),
      phone: '+91 98765 43210',
      currency: 'INR',
    });
    console.log('[seed] created demo user');
  } else {
    console.log('[seed] demo user already exists');
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const existingCount = transactionModel.list(user.id, { page: 1, limit: 1 }).total;
  if (existingCount === 0) {
    const samples = [
      // [type, category, amount, paymentMethod, note, daysAgo]
      ['Income', 'Salary', 8000, 'Bank Transfer', 'Monthly salary', 5],
      ['Income', 'Freelancing', 2500, 'UPI', 'Logo design project', 12],
      ['Expense', 'Food', 450, 'UPI', 'Groceries', 1],
      ['Expense', 'Food', 280, 'Cash', 'Lunch with team', 3],
      ['Expense', 'Shopping', 1200, 'Card', 'New sneakers', 6],
      ['Expense', 'Travel', 640, 'UPI', 'Metro recharge + cab', 4],
      ['Expense', 'Bills', 1100, 'Auto-pay', 'Electricity + internet', 8],
      ['Expense', 'Entertainment', 350, 'Card', 'Movie night', 2],
      ['Expense', 'Health', 260, 'Cash', 'Pharmacy', 10],
      ['Investment', 'Investment', 1500, 'Net Banking', 'Index fund SIP', 5],
      ['Expense', 'Shopping', 900, 'UPI', 'Weekend haul', 15],
      ['Expense', 'Food', 520, 'UPI', 'Restaurant', 20],
    ];

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const stmtCtx = { userId: user.id };
    samples.forEach(([type, category, amount, paymentMethod, note, daysAgo]) => {
      const raw = new Date(now.getTime() - daysAgo * DAY);
      const d = raw < firstOfMonth ? firstOfMonth : raw;
      if (d < threeMonthsAgo) d.setMonth(d.getMonth() + 1);
      transactionModel.create({
        ...stmtCtx,
        type,
        category,
        amount,
        paymentMethod,
        note,
        date: dateKey(d),
      });
    });
    console.log(`[seed] inserted ${samples.length} transactions`);
  } else {
    console.log('[seed] transactions already present');
  }

  const month = monthKey();
  budgetModel.ensure(user.id, month);
  budgetModel.updateSettings(user.id, month, { monthlyBudget: 5000, savingGoal: 2000 });

  if (goalModel.list(user.id).length === 0) {
    goalModel.create({
      userId: user.id,
      name: 'Emergency Fund',
      targetAmount: 50000,
      savedAmount: 8500,
      deadline: '2027-12-31',
      category: 'Savings',
      note: '3 months of living expenses',
    });
    console.log('[seed] created a savings goal');
  }

  const { recomputeTotals } = require('../services/budgetService');
  recomputeTotals(user.id, month);

  notificationModel.create(user.id, {
    title: 'Seed complete',
    message: 'Your demo workspace is ready. Explore the dashboard and insights.',
    type: 'success',
  });

  aiService.generateInsights(user.id);

  console.log('\nSeed finished. Log in with:');
  console.log('  email:    demo@spendsnap.com');
  console.log('  password: demo12345');
};

main();
