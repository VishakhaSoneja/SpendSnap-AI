/**
 * End-to-end smoke test — boots the real Express app against a temporary
 * SQLite database and exercises every route group in the specification.
 *
 * Run: npm test
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.DB_PATH = require('path').join(require('os').tmpdir(), `spendsnap-test-${Date.now()}.sqlite`);

const assert = require('node:assert');

const check = (name, condition, extra = '') => {
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`  [${status}] ${name}${extra ? ` — ${extra}` : ''}`);
  if (!condition) process.exitCode = 1;
};

(async () => {
  const { initDb, closeDb } = require('../config/db');
  const app = require('../server');
  initDb();

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const call = async (path, { method = 'GET', token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status, json, text };
  };

  console.log('\nSpendSnap AI — backend smoke test (SQLite)');
  console.log('-------------------------------------------');

  try {
    // ---- Health ----
    const health = await call('/health');
    check('GET /health', health.status === 200 && health.json.success === true);

    // ---- Auth ----
    const reg = await call('/auth/register', {
      method: 'POST',
      body: { fullName: 'Meera Rao', email: 'meera@test.com', password: 'password123' },
    });
    check('POST /auth/register', reg.status === 201 && reg.json.data.token && reg.json.data.user.id, `status=${reg.status}`);
    const token = reg.json.data.token;

    const dup = await call('/auth/register', {
      method: 'POST',
      body: { fullName: 'Meera Rao', email: 'meera@test.com', password: 'password123' },
    });
    check('register rejects duplicate email (409)', dup.status === 409);

    const badLogin = await call('/auth/login', { method: 'POST', body: { email: 'meera@test.com', password: 'wrong-pass' } });
    check('login rejects wrong password (401)', badLogin.status === 401);

    const login = await call('/auth/login', { method: 'POST', body: { email: 'meera@test.com', password: 'password123' } });
    check('POST /auth/login', login.status === 200 && login.json.data.token, `status=${login.status}`);

    const profile = await call('/auth/profile', { token });
    check('GET /auth/profile', profile.status === 200 && profile.json.data.email === 'meera@test.com');

    const updProfile = await call('/auth/update-profile', { method: 'PUT', token, body: { fullName: 'Meera Rao Updated', phone: '+91 90000 12345' } });
    check('PUT /auth/update-profile', updProfile.status === 200 && updProfile.json.data.fullName === 'Meera Rao Updated');

    const changePass = await call('/auth/change-password', { method: 'PUT', token, body: { currentPassword: 'password123', newPassword: 'new-password456' } });
    check('PUT /auth/change-password', changePass.status === 200);

    const noAuth = await call('/dashboard');
    check('protected route rejects missing token (401)', noAuth.status === 401);

    // ---- Budget ----
    const budget = await call('/budget', { method: 'POST', token, body: { monthlyBudget: 5000, savingGoal: 2000 } });
    check('POST /budget', budget.status === 201 && budget.json.data.monthlyBudget === 5000, `status=${budget.status}`);
    const budgetMonth = budget.json.data.month;

    const getBudget = await call(`/budget?month=${budgetMonth}`, { token });
    check('GET /budget', getBudget.status === 200 && getBudget.json.data.remainingBudget === 5000);

    // ---- Transactions ----
    const txIncome = await call('/transactions', { method: 'POST', token, body: { type: 'Income', category: 'Salary', amount: 8000, paymentMethod: 'Bank Transfer', note: 'Monthly salary' } });
    const txExpense = await call('/transactions', { method: 'POST', token, body: { type: 'Expense', category: 'Food', amount: 1200, paymentMethod: 'UPI', note: 'Groceries at store' } });
    const txExpense2 = await call('/transactions', { method: 'POST', token, body: { type: 'Expense', category: 'Shopping', amount: 800 } });
    const txInvest = await call('/transactions', { method: 'POST', token, body: { type: 'Investment', category: 'Investment', amount: 1500, paymentMethod: 'Net Banking' } });
    check('POST /transactions (income/expense/investment)', [txIncome, txExpense, txExpense2, txInvest].every((r) => r.status === 201));

    const txId = txExpense.json.data.id;
    const listTx = await call('/transactions?type=Expense', { token });
    check('GET /transactions (filtered)', listTx.status === 200 && listTx.json.data.transactions.length === 2);

    const searchTx = await call('/transactions?q=groceries', { token });
    check('GET /transactions (search q)', searchTx.status === 200 && searchTx.json.data.transactions.length === 1 && searchTx.json.data.transactions[0].note.includes('Groceries'));

    const oneTx = await call(`/transactions/${txId}`, { token });
    check('GET /transactions/:id', oneTx.status === 200 && oneTx.json.data.category === 'Food');

    const updTx = await call(`/transactions/${txId}`, { method: 'PUT', token, body: { amount: 500, category: 'Travel' } });
    check('PUT /transactions/:id', updTx.status === 200 && updTx.json.data.amount === 500);

    // Budget should now reflect remaining = 5000 - (500 + 800) = 3700
    const budgetAfter = await call(`/budget?month=${budgetMonth}`, { token });
    check('budget totals recomputed after create/update', budgetAfter.json.data.totalSpent === 1300 && budgetAfter.json.data.remainingBudget === 3700, `totalSpent=${budgetAfter.json.data.totalSpent}`);

    // ---- Type-aware category validation ----
    const badExpenseCat = await call('/transactions', { method: 'POST', token, body: { type: 'Expense', category: 'Salary', amount: 100 } });
    check('Expense rejects income-only category (400)', badExpenseCat.status === 400, `status=${badExpenseCat.status}`);
    const badIncomeCat = await call('/transactions', { method: 'POST', token, body: { type: 'Income', category: 'Food', amount: 100 } });
    check('Income rejects expense-only category (400)', badIncomeCat.status === 400, `status=${badIncomeCat.status}`);
    const badAssetCat = await call('/transactions', { method: 'POST', token, body: { type: 'Investment', category: 'Food', amount: 100 } });
    check('Investment rejects non-asset category (400)', badAssetCat.status === 400, `status=${badAssetCat.status}`);

    // ---- Investment with a real asset type ----
    const txAsset = await call('/transactions', { method: 'POST', token, body: { type: 'Investment', category: 'Stocks', amount: 2000, paymentMethod: 'Net Banking', note: 'SIP' } });
    check('POST investment with asset type Stocks (201)', txAsset.status === 201 && txAsset.json.data.category === 'Stocks', `status=${txAsset.status}`);
    const investId = txAsset.status === 201 ? txAsset.json.data.id : null;

    // ---- Cross-user isolation ----
    const reg2 = await call('/auth/register', { method: 'POST', body: { fullName: 'Other User', email: 'other@test.com', password: 'password123' } });
    const token2 = reg2.status === 201 ? reg2.json.data.token : null;
    const otherId = reg2.status === 201 ? reg2.json.data.user.id : null;
    check('second user registered for isolation test', reg2.status === 201 && !!token2);
    const foreignTx = await call(`/transactions/${txId}`, { token: token2 });
    check('user B cannot read user A transaction (404)', foreignTx.status === 404, `status=${foreignTx.status}`);
    const foreignDel = investId ? await call(`/transactions/${investId}`, { method: 'DELETE', token: token2 }) : null;
    check('user B cannot delete user A transaction (404)', !investId || foreignDel.status === 404, `status=${foreignDel ? foreignDel.status : 'n/a'}`);
    const dash2 = await call('/dashboard', { token: token2 });
    check('user B dashboard is empty (no leaked totals)', dash2.status === 200 && dash2.json.data.totalBalance === 0 && dash2.json.data.recentTransactions.length === 0, JSON.stringify(dash2.json.data));
    if (investId) {
      const stillThere = await call(`/transactions/${investId}`, { token });
      check('user A transaction intact after user B delete attempt', stillThere.status === 200);
    }

    // ---- Dashboard ----
    const dash = await call('/dashboard', { token });
    check('GET /dashboard', dash.status === 200, `status=${dash.status}`);
    if (dash.status === 200) {
      check('dashboard totals correct', dash.json.data.totalIncome === 8000 && dash.json.data.totalExpense === 1300 && dash.json.data.totalInvestment === 3500 && dash.json.data.totalBalance === 3200, JSON.stringify(dash.json.data));
      check('dashboard includes categories + recent + summary', Array.isArray(dash.json.data.expenseCategories) && dash.json.data.expenseCategories.length === 2 && dash.json.data.recentTransactions.length === 5 && dash.json.data.monthlySummary.length === 6);
      check('dashboard includes investment categories', Array.isArray(dash.json.data.investmentCategories) && dash.json.data.investmentCategories.some((c) => c.category === 'Stocks' && c.total === 2000), JSON.stringify(dash.json.data.investmentCategories));
    }

    // ---- Analytics ----
    const aDaily = await call('/analytics/daily?type=Expense', { token });
    check('GET /analytics/daily', aDaily.status === 200 && aDaily.json.data.series.length > 0 && aDaily.json.data.series[0].key);
    const aWeekly = await call('/analytics/weekly', { token });
    check('GET /analytics/weekly', aWeekly.status === 200 && aWeekly.json.data.series.length === 8);
    const aMonthly = await call('/analytics/monthly?type=Expense', { token });
    check('GET /analytics/monthly', aMonthly.status === 200 && aMonthly.json.data.series.length === 12);
    const aYearly = await call('/analytics/yearly', { token });
    check('GET /analytics/yearly', aYearly.status === 200 && aYearly.json.data.series.length === 5);
    const aBadType = await call('/analytics/monthly?type=Bogus', { token });
    check('analytics rejects invalid type (400)', aBadType.status === 400);

    // ---- Goals ----
    const goal = await call('/goals', { method: 'POST', token, body: { name: 'Emergency Fund', targetAmount: 50000, savedAmount: 5000 } });
    check('POST /goals', goal.status === 201 && goal.json.data.progressPercent === 10, `status=${goal.status}`);
    const goalId = goal.json.data.id;

    const goals = await call('/goals', { token });
    check('GET /goals', goals.status === 200 && goals.json.data.length === 1);

    const oneGoal = await call(`/goals/${goalId}`, { token });
    check('GET /goals/:id', oneGoal.status === 200 && oneGoal.json.data.targetAmount === 50000);

    const addSavings = await call(`/goals/${goalId}/add-savings`, { method: 'PATCH', token, body: { amount: 45000 } });
    check('PATCH /goals/:id/add-savings (achieved)', addSavings.status === 200 && addSavings.json.data.status === 'achieved' && addSavings.json.data.progressPercent === 100);

    const updGoal = await call(`/goals/${goalId}`, { method: 'PUT', token, body: { name: 'Rainy Day Fund' } });
    check('PUT /goals/:id', updGoal.status === 200 && updGoal.json.data.name === 'Rainy Day Fund');

    const delGoal = await call(`/goals/${goalId}`, { method: 'DELETE', token });
    check('DELETE /goals/:id', delGoal.status === 200);

    // ---- AI insights ----
    const insights = await call('/ai/insights', { token });
    check('GET /ai/insights', insights.status === 200 && Array.isArray(insights.json.data), `status=${insights.status}`);
    if (insights.status === 200) {
      check('insights include a budget/trend message', insights.json.data.length > 0);
    }

    // ---- Notifications ----
    const notifs = await call('/notifications', { token });
    check('GET /notifications', notifs.status === 200 && notifs.json.data.notifications.length > 0 && typeof notifs.json.data.unreadCount === 'number');
    const markRead = await call('/notifications/read', { method: 'PUT', token, body: {} });
    check('PUT /notifications/read', markRead.status === 200);
    const notifsRead = await call('/notifications?unreadOnly=true', { token });
    check('notifications marked read', notifsRead.json.data.unreadCount === 0);

    // ---- CSV export ----
    const csvRes = await fetch(`${base}/export/csv`, { headers: { Authorization: `Bearer ${token}` } });
    const csv = await csvRes.text();
    check('GET /export/csv', csvRes.status === 200 && csvRes.headers.get('content-type').includes('text/csv') && csv.includes('Category') && csv.includes('Travel') && csv.includes('Transaction ID'));

    // ---- Transaction delete recomputes budget ----
    const del = await call(`/transactions/${txExpense2.json.data.id}`, { method: 'DELETE', token });
    check('DELETE /transactions/:id', del.status === 200);
    const budgetFinal = await call(`/budget?month=${budgetMonth}`, { token });
    check('budget recomputed after delete (500)', budgetFinal.json.data.totalSpent === 500, `totalSpent=${budgetFinal.json.data.totalSpent}`);

    // ---- Validation errors ----
    const badTx = await call('/transactions', { method: 'POST', token, body: { type: 'Expense', category: 'Nope', amount: -5 } });
    check('validation errors return 400 with field list', badTx.status === 400 && Array.isArray(badTx.json.errors));

    const badGoal = await call('/goals', { method: 'POST', token, body: { targetAmount: -1 } });
    check('goal validation returns 400', badGoal.status === 400 && Array.isArray(badGoal.json.errors));

    // ---- 404 ----
    const nf = await call('/does-not-exist', { token });
    check('unknown route returns 404', nf.status === 404);

    console.log('\n-------------------------------------------');
    console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
  } catch (err) {
    console.error('\n[test] unexpected failure:', err);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    closeDb();
    try { require('fs').unlinkSync(process.env.DB_PATH); } catch {}
  }
})();
