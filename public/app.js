'use strict';

/* ================= Constants ================= */
const TYPES = ['Income', 'Expense', 'Investment'];
const ASSET_TYPES = ['Investment', 'Stocks', 'Mutual Funds', 'Gold', 'Crypto', 'FD', 'Real Estate', 'Bonds', 'Other'];
const CATEGORIES = ['Food', 'Shopping', 'Travel', 'Bills', 'Health', 'Education', 'Entertainment', 'Investment', 'Salary', 'Freelancing', 'Pocket Money', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'Net Banking', 'Bank Transfer', 'Auto-pay', 'Other'];
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };
const CATEGORY_ICONS = {
  Food: '🍽', Shopping: '🛍', Travel: '✈️', Bills: '🧾', Health: '🩺', Education: '📚',
  Entertainment: '🎬', Investment: '📈', Salary: '💼', Freelancing: '🧑‍💻', 'Pocket Money': '👛', Other: '✨',
  Stocks: '📊', 'Mutual Funds': '🌳', Gold: '🪙', Crypto: '₿', FD: '🏦', 'Real Estate': '🏠', Bonds: '📜'
};

/* ================= State ================= */
const state = {
  token: localStorage.getItem('ss_token') || null,
  user: JSON.parse(localStorage.getItem('ss_user') || 'null'),
  tx: { page: 1, limit: 20 },
  analytics: { period: 'daily', type: '', from: '', to: '' },
  budgetMonth: '',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const symbol = () => CURRENCY_SYMBOLS[state.user?.currency] || '₹';
const fmt = (n) => symbol() + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const shortDate = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

/* ================= API helper ================= */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, { ...opts, headers });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) {
    const body = await res.json();
    if (!res.ok) {
      const err = new Error(body.message || 'Request failed');
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }
  if (!res.ok) throw new Error('Request failed (' + res.status + ')');
  return res;
}

async function apiForm(path, { method = 'POST', formData } = {}) {
  const headers = {};
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, { method, headers, body: formData });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) {
    const body = await res.json();
    if (!res.ok) {
      const err = new Error(body.message || 'Request failed');
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }
  if (!res.ok) throw new Error('Request failed (' + res.status + ')');
  return res;
}

/* ================= Toast / Modal ================= */
let toastTimer;
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function openModal(title, bodyHTML, { wide = false } = {}) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  const wrap = $('#modal-backdrop');
  if (wide) wrap.classList.add('wide');
  wrap.hidden = false;
  return wrap;
}
function closeModal() {
  $('#modal-backdrop').hidden = true;
}
$('#modal-close').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ================= Auth ================= */
function showAuth() {
  $('#app-view').hidden = true;
  $('#auth-view').hidden = false;
}
function showApp() {
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
  $('#nav-name').textContent = state.user?.fullName || 'User';
  $('#nav-avatar').textContent = (state.user?.fullName || '?').trim().charAt(0).toUpperCase();
  switchView('dashboard');
}

function switchTab(role) {
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.role === role));
  $('#login-form').style.display = role === 'login' ? 'flex' : 'none';
  $('#signup-form').style.display = role === 'signup' ? 'flex' : 'none';
  $('#auth-title').textContent = role === 'login' ? 'Welcome back' : 'Create your account';
  $('#auth-sub').textContent = role === 'login' ? 'Log in to see your money, insights and goals.' : 'Start tracking expenses with SpendSnap AI.';
}
$('#tab-login').addEventListener('click', () => switchTab('login'));
$('#tab-signup').addEventListener('click', () => switchTab('signup'));

function fieldError(field, hasErr) { field.closest('.field').classList.toggle('has-error', hasErr); }
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function doLogin(e) {
  e.preventDefault();
  const email = $('#login-email'), pass = $('#login-pass');
  const bad = !emailRe.test(email.value.trim()) || pass.value.trim().length < 8;
  fieldError(email, !emailRe.test(email.value.trim()));
  fieldError(pass, pass.value.trim().length < 8);
  if (bad) return;
  $('#login-note').textContent = '';
  try {
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.value, password: pass.value }) });
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('ss_token', state.token);
    localStorage.setItem('ss_user', JSON.stringify(state.user));
    showApp();
    toast('Welcome back, ' + state.user.fullName + '! 👋');
  } catch (err) {
    $('#login-note').textContent = err.message;
  }
}

async function doSignup(e) {
  e.preventDefault();
  const name = $('#su-name'), email = $('#su-email'), pass = $('#su-pass');
  const bad = name.value.trim().length < 2 || !emailRe.test(email.value.trim()) || pass.value.trim().length < 8;
  fieldError(name, name.value.trim().length < 2);
  fieldError(email, !emailRe.test(email.value.trim()));
  fieldError(pass, pass.value.trim().length < 8);
  if (bad) return;
  $('#signup-note').textContent = '';
  try {
    const res = await api('/auth/register', { method: 'POST', body: JSON.stringify({ fullName: name.value.trim(), email: email.value.trim(), password: pass.value }) });
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('ss_token', state.token);
    localStorage.setItem('ss_user', JSON.stringify(state.user));
    showApp();
    toast('Account created — welcome to SpendSnap AI! 🎉');
  } catch (err) {
    $('#signup-note').textContent = err.message;
  }
}

function logout() {
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_user');
  state.token = null;
  state.user = null;
  showAuth();
  toast('Logged out. See you soon!');
}

$('#login-form').addEventListener('submit', doLogin);
$('#signup-form').addEventListener('submit', doSignup);
$('#logout-btn').addEventListener('click', logout);
$$('#login-form input, #signup-form input').forEach((inp) =>
  inp.addEventListener('input', () => fieldError(inp, false))
);

/* ================= Navigation ================= */
function switchView(name) {
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
  $$('.navlinks a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const loaders = {
    dashboard: loadDashboard, transactions: loadTransactions, analytics: loadAnalytics,
    budget: loadBudget, goals: loadGoals, insights: loadInsights,
    notifications: loadNotifications, profile: loadProfile,
  };
  if (loaders[name]) loaders[name]();
}
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-view]');
  if (link) { e.preventDefault(); switchView(link.dataset.view); }
});
$('#brand-home').addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
$('#dash-add-tx').addEventListener('click', openQuick);
$('#tx-add').addEventListener('click', openQuick);

/* ================= Dashboard ================= */
async function loadDashboard() {
  try {
    const res = await api('/dashboard');
    const d = res.data;
    $('#dash-month').textContent = d.month;
    $('#dash-month-badge').textContent = d.month;
    $('#dash-name').textContent = state.user ? ', ' + state.user.fullName.split(' ')[0] : '';
    $('#dash-total-balance').textContent = fmt(d.totalBalance);
    $('#dash-income').textContent = '+' + fmt(d.totalIncome);
    $('#dash-expense').textContent = '-' + fmt(d.totalExpense);
    $('#dash-invested').textContent = fmt(d.totalInvestment);
    $('#dash-budget-left').textContent = fmt(d.remainingBudget);
    $('#dash-budget-left').style.color = d.remainingBudget < 0 ? '#F5B7A4' : '';
    $('#dash-budget-spent').textContent = fmt(d.totalExpense);
    $('#dash-budget-total').textContent = fmt(d.monthlyBudget);
    $('#dash-saving-goal').textContent = fmt(d.savingGoal);
    const pct = Math.min(d.budgetSpentPercent, 100);
    $('#dash-budget-bar').style.width = pct + '%';
    $('#dash-budget-pct').textContent = d.budgetSpentPercent + '% of limit used';
    $('#dash-budget-pct').style.color = d.budgetSpentPercent >= 90 ? 'var(--danger)' : '';

    // categories
    const cats = d.expenseCategories || [];
    $('#dash-cat-total').textContent = cats.length ? cats.reduce((s, c) => s + c.total, 0).toLocaleString('en-IN') + ' spent' : '';
    $('#dash-categories').innerHTML = cats.length
      ? cats.map((c) => `
          <div class="cat-row"><span>${CATEGORY_ICONS[c.category] || '✨'} ${esc(c.category)}</span><b>${fmt(c.total)} · ${c.percentage}%</b></div>
          <div class="cat-bar"><div style="width:${Math.max(c.percentage, 3)}%"></div></div>
        `).join('')
      : '<div class="empty">No expenses yet this month.</div>';

    // recent
    $('#dash-recent').innerHTML = (d.recentTransactions || []).map(txRow).join('') || '<div class="empty">No transactions yet.</div>';

    // investments
    const invs = d.investmentCategories || [];
    $('#dash-invest-total').textContent = invs.length ? fmt(invs.reduce((s, c) => s + c.total, 0)) + ' this month' : '';
    $('#dash-investments').innerHTML = invs.length
      ? invs.map((c) => `
          <div class="inv-card">
            <div class="inv-name"><span style="font-size:16px;">${CATEGORY_ICONS[c.category] || '📈'}</span>${esc(c.category)}
              <span class="inv-pct">${c.percentage}%</span>
            </div>
            <div class="inv-amt">${fmt(c.total)}</div>
          </div>`).join('')
      : '<div class="empty">No investments yet this month.</div>';

    // chart
    const summary = d.monthlySummary || [];
    renderBars($('#dash-chart'), summary.map((s) => ({ key: s.month.slice(5) + '/' + s.month.slice(2, 4), expense: s.expense, income: s.income })), 'expense');
    $('#dash-summary-sub').textContent = 'Income vs expenses';

    // goals + insights preview
    renderDashGoals();
    renderDashInsights();
  } catch (err) {
    if (err.status === 401) return sessionExpired();
    toast(err.message, true);
  }
}

function txRow(t) {
  const sign = t.type === 'Expense' ? '-' : t.type === 'Investment' ? '' : '+';
  const cls = t.type === 'Expense' ? 'minus' : 'plus';
  return `
    <div class="tx-row">
      <div class="tx-icon" style="background:rgba(216,181,138,0.28);">${CATEGORY_ICONS[t.category] || '✨'}</div>
      <div class="tx-info"><b>${esc(t.category)}${t.note ? ' · ' + esc(t.note) : ''}</b><span>${shortDate(t.date)} · ${esc(t.paymentMethod)}</span></div>
      <div class="tx-amt ${t.type === 'Expense' ? 'minus' : 'plus'}">${sign}${fmt(t.amount)}</div>
    </div>`;
}

async function renderDashGoals() {
  try {
    const res = await api('/goals');
    const goals = res.data;
    $('#dash-goals').innerHTML = goals.length
      ? goals.slice(0, 3).map((g) => `
          <div class="cat-row"><span>${esc(g.name)}</span><b>${g.progressPercent}%</b></div>
          <div class="cat-bar"><div style="width:${Math.max(g.progressPercent, 3)}%"></div></div>
        `).join('')
      : '<div class="empty">No savings goals yet.</div>';
  } catch { /* ignore */ }
}

async function renderDashInsights() {
  try {
    const res = await api('/ai/insights');
    const items = res.data;
    $('#dash-insights').innerHTML = items.length
      ? items.slice(0, 2).map(insightCard).join('')
      : '<div class="empty">Insights appear once you have some activity.</div>';
  } catch { /* ignore */ }
}

function renderBars(el, data, key) {
  const values = data.map((d) => d[key] || 0);
  const max = Math.max.apply(null, values.concat([1]));
  el.innerHTML = data.map((d) => {
    const h = d[key] > 0 ? Math.max((d[key] / max) * 100, 3) : 0;
    return `
      <div class="bc-col" title="${d.key}: ${fmt(d[key])}">
        <div class="bc-val">${d[key] > 0 ? fmt(d[key]) : ''}</div>
        <div class="bc-bar ${h === 0 ? 'zero' : ''}" style="height:${h}%"></div>
        <div class="bc-label">${esc(d.key)}</div>
      </div>`;
  }).join('');
}

/* ================= Transactions ================= */
function txFilters() {
  const params = { page: state.tx.page, limit: state.tx.limit };
  const q = $('#tx-search')?.value.trim();
  const type = $('#tx-type')?.value;
  const category = $('#tx-category')?.value;
  const month = $('#tx-month')?.value;
  if (q) params.q = q;
  if (type) params.type = type;
  if (category) params.category = category;
  if (month) params.month = month;
  return params;
}

async function loadTransactions() {
  const params = txFilters();
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await api('/transactions?' + qs);
    const { transactions, pagination } = res.data;
    state.txList = transactions;
    $('#tx-empty').hidden = transactions.length > 0;
    $('#tx-body').innerHTML = transactions.length
      ? transactions.map((t) => `
          <tr>
            <td class="mono" style="white-space:nowrap;">${shortDate(t.date)}</td>
            <td><span class="tx-type ${t.type}">${t.type}</span></td>
            <td>${CATEGORY_ICONS[t.category] || ''} ${esc(t.category)}</td>
            <td style="color:var(--ink-soft);">${esc(t.note || '—')}</td>
            <td style="color:var(--ink-soft);">${esc(t.paymentMethod)}</td>
            <td style="text-align:right;" class="tx-amt ${t.type === 'Expense' ? 'minus' : 'plus'}">${t.type === 'Expense' ? '-' : ''}${fmt(t.amount)}</td>
            <td>
              <div class="tx-act">
                <button class="icon-btn" data-edit="${t.id}" title="Edit">✎</button>
                <button class="icon-btn danger" data-del="${t.id}" title="Delete">✕</button>
              </div>
            </td>
          </tr>`).join('')
      : '';
    $('#tx-pager').innerHTML = `
      <button ${pagination.page <= 1 ? 'disabled' : ''} data-pg="${pagination.page - 1}">← Prev</button>
      <span>Page ${pagination.page} of ${Math.max(pagination.pages, 1)} · ${pagination.total} total</span>
      <button ${pagination.page >= pagination.pages ? 'disabled' : ''} data-pg="${pagination.page + 1}">Next →</button>`;
  } catch (err) {
    if (err.status === 401) return sessionExpired();
    toast(err.message, true);
  }
}

function bindTxEvents() {
  $('#tx-body').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) {
      const t = (state.txList || []).find((x) => x.id === Number(ed.dataset.edit));
      if (t) openTxForEdit(t);
    }
    if (del) confirmDeleteTx(Number(del.dataset.del));
  });
  $('#tx-pager').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pg]');
    if (btn) { state.tx.page = Number(btn.dataset.pg); loadTransactions(); }
  });
  ['tx-search', 'tx-type', 'tx-category', 'tx-month'].forEach((id) => {
    const el = $('#' + id);
    const ev = id === 'tx-search' ? 'input' : 'change';
    el.addEventListener(ev, () => { state.tx.page = 1; loadTransactions(); });
  });
  $('#tx-export').addEventListener('click', exportCsv);
}
bindTxEvents();

async function exportCsv() {
  const params = txFilters();
  delete params.page; delete params.limit;
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch('/api/export/csv?' + qs, { headers: { Authorization: 'Bearer ' + state.token } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spendsnap-transactions.csv';
    a.click();
    toast('CSV downloaded.');
  } catch (err) {
    toast(err.message, true);
  }
}

const INCOME_CATEGORIES = ['Salary', 'Freelancing', 'Pocket Money', 'Investment', 'Other'];
const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => !INCOME_CATEGORIES.includes(c));
const todayISO = () => new Date().toISOString().slice(0, 10);

function fillSelect(id, options, selected) {
  const el = $('#' + id);
  el.innerHTML = options
    .map((o) => `<option value="${o}" ${o === selected ? 'selected' : ''}>${o}</option>`)
    .join('');
}

/* ================= Quick add chooser ================= */
function openQuick() { $('#quick-modal').hidden = false; }
function closeQuick() { $('#quick-modal').hidden = true; }
$('#quick-close').addEventListener('click', closeQuick);
$('#quick-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeQuick();
  const opt = e.target.closest('[data-quick]');
  if (opt) { closeQuick(); ({ expense: openExpModal, income: openIncModal, investment: openInvModal })[opt.dataset.quick](); }
});

/* ================= Expense modal ================= */
function openExpModal(id = null) {
  const t = id ? (state.txList || []).find((x) => x.id === id) : null;
  const editing = !!t;
  $('#exp-title').textContent = editing ? 'Edit Expense' : 'Add Expense';
  $('#exp-submit').textContent = editing ? 'Save changes' : 'Save expense';
  $('#e-amount').value = (t && t.amount) || '';
  fillSelect('e-category', EXPENSE_CATEGORIES, t && t.category);
  fillSelect('e-payment', PAYMENT_METHODS, (t && t.paymentMethod) || 'UPI');
  $('#e-date').value = (t && t.date) || todayISO();
  $('#e-note').value = (t && t.note) || '';
  $('#e-receipt').value = '';
  $('#e-receipt-name').innerHTML = t && t.receipt
    ? `Current: <a href="${esc(t.receipt)}" target="_blank" rel="noopener">${esc(t.receipt.split('/').pop())}</a>` : '';
  $('#exp-modal').dataset.editing = editing ? String(id) : '';
  $('#exp-modal').hidden = false;
  $('#e-amount').focus();
}
function closeExpModal() { $('#exp-modal').hidden = true; }
$('#exp-close').addEventListener('click', closeExpModal);
$('#exp-cancel').addEventListener('click', closeExpModal);
$('#exp-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeExpModal(); });
$('#e-receipt').addEventListener('change', (e) => {
  $('#e-receipt-name').textContent = e.target.files[0] ? 'New: ' + e.target.files[0].name : '';
});

$('#exp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#exp-modal').dataset.editing;
  const amount = Number($('#e-amount').value);
  const date = $('#e-date').value;
  if (!(amount > 0)) return toast('Please enter an amount greater than 0.', true);
  if (!date) return toast('Please choose a date.', true);
  const file = $('#e-receipt').files[0];
  const payload = {
    type: 'Expense',
    category: $('#e-category').value,
    amount,
    date,
    paymentMethod: $('#e-payment').value,
    note: $('#e-note').value.trim(),
  };
  try {
    if (file) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
      fd.append('receipt', file);
      await apiForm('/transactions' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', formData: fd });
    } else {
      if (id) await api('/transactions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/transactions', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeExpModal();
    toast(id ? 'Expense updated.' : 'Expense added.');
    afterSave();
  } catch (err) { toast(err.message, true); }
});

/* ================= Income modal ================= */
function openIncModal(id = null) {
  const t = id ? (state.txList || []).find((x) => x.id === id) : null;
  const editing = !!t;
  $('#inc-title').textContent = editing ? 'Edit Income' : 'Add Income';
  $('#inc-submit').textContent = editing ? 'Save changes' : 'Save income';
  $('#i-amount').value = (t && t.amount) || '';
  fillSelect('i-source', INCOME_CATEGORIES, t && t.category);
  fillSelect('i-payment', PAYMENT_METHODS, (t && t.paymentMethod) || 'Bank Transfer');
  $('#i-date').value = (t && t.date) || todayISO();
  $('#i-note').value = (t && t.note) || '';
  $('#inc-modal').dataset.editing = editing ? String(id) : '';
  $('#inc-modal').hidden = false;
  $('#i-amount').focus();
}
function closeIncModal() { $('#inc-modal').hidden = true; }
$('#inc-close').addEventListener('click', closeIncModal);
$('#inc-cancel').addEventListener('click', closeIncModal);
$('#inc-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeIncModal(); });

$('#inc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#inc-modal').dataset.editing;
  const amount = Number($('#i-amount').value);
  const date = $('#i-date').value;
  if (!(amount > 0)) return toast('Please enter an amount greater than 0.', true);
  if (!date) return toast('Please choose a date.', true);
  const payload = {
    type: 'Income',
    category: $('#i-source').value,
    amount,
    date,
    paymentMethod: $('#i-payment').value,
    note: $('#i-note').value.trim(),
  };
  try {
    if (id) await api('/transactions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/transactions', { method: 'POST', body: JSON.stringify(payload) });
    closeIncModal();
    toast(id ? 'Income updated.' : 'Income added.');
    afterSave();
  } catch (err) { toast(err.message, true); }
});

/* ================= Investment modal ================= */
function openInvModal(id = null) {
  const t = id ? (state.txList || []).find((x) => x.id === id) : null;
  const editing = !!t;
  $('#inv-title').textContent = editing ? 'Edit Investment' : 'Add Investment';
  $('#inv-submit').textContent = editing ? 'Save changes' : 'Save investment';
  fillSelect('v-asset', ASSET_TYPES, (t && t.category) || 'Stocks');
  $('#v-amount').value = (t && t.amount) || '';
  $('#v-date').value = (t && t.date) || todayISO();
  $('#v-note').value = (t && t.note) || '';
  $('#inv-modal').dataset.editing = editing ? String(id) : '';
  $('#inv-modal').hidden = false;
  $('#v-amount').focus();
}
function closeInvModal() { $('#inv-modal').hidden = true; }
$('#inv-close').addEventListener('click', closeInvModal);
$('#inv-cancel').addEventListener('click', closeInvModal);
$('#inv-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeInvModal(); });

$('#inv-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#inv-modal').dataset.editing;
  const amount = Number($('#v-amount').value);
  const date = $('#v-date').value;
  if (!(amount > 0)) return toast('Please enter an amount greater than 0.', true);
  if (!date) return toast('Please choose a date.', true);
  const payload = {
    type: 'Investment',
    category: $('#v-asset').value,
    amount,
    date,
    paymentMethod: 'Net Banking',
    note: $('#v-note').value.trim(),
  };
  try {
    if (id) await api('/transactions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/transactions', { method: 'POST', body: JSON.stringify(payload) });
    closeInvModal();
    toast(id ? 'Investment updated.' : 'Investment added.');
    afterSave();
  } catch (err) { toast(err.message, true); }
});

function afterSave() {
  loadTransactions();
  if ($('#view-dashboard').hidden === false) loadDashboard();
  if ($('#view-analytics').hidden === false) refreshChart();
}

function openTxForEdit(t) {
  if (t.type === 'Expense') openExpModal(t.id);
  else if (t.type === 'Income') openIncModal(t.id);
  else openInvModal(t.id);
}

async function confirmDeleteTx(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await api('/transactions/' + id, { method: 'DELETE' });
    toast('Transaction deleted.');
    loadTransactions();
    if ($('#view-dashboard').hidden === false) loadDashboard();
    if ($('#view-analytics').hidden === false) refreshChart();
  } catch (err) { toast(err.message, true); }
}

/* ================= Analytics ================= */
async function loadAnalytics() {
  $('#an-type').value = state.analytics.type;
  if (state.analytics.period === 'daily') {
    $('#an-range').style.display = 'flex';
  } else {
    $('#an-range').style.display = 'none';
  }
  await refreshChart();
}

async function refreshChart() {
  const period = state.analytics.period;
  const type = $('#an-type').value;
  state.analytics.type = type;
  let path = '/analytics/' + period + '?';
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (period === 'daily') {
    const from = $('#an-from').value || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = $('#an-to').value || new Date().toISOString().slice(0, 10);
    if (to <= from) return toast('To must be after From.', true);
    params.set('from', from);
    params.set('to', to);
  }
  path += params.toString();
  try {
    const res = await api(path);
    const d = res.data;
    $('#an-chart-title').textContent = period.charAt(0).toUpperCase() + period.slice(1) + ' ' + (type || 'all activity');
    $('#an-chart-sub').textContent = d.series.length + ' buckets';
    renderBars($('#an-chart'), d.series.map((s) => ({ key: s.key, expense: s.total })), 'expense');
    const total = d.series.reduce((sum, s) => sum + s.total, 0);
    $('#an-totals').innerHTML = `
      <div class="cat-row"><span>Total</span><b>${fmt(total)}</b></div>
      <div class="cat-row"><span>Transactions</span><b>${d.series.reduce((sum, s) => sum + s.count, 0)}</b></div>`;
  } catch (err) { toast(err.message, true); }
}

$$('.seg button').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.seg button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.analytics.period = btn.dataset.a;
    if (btn.dataset.a === 'daily') $('#an-range').style.display = 'flex';
    else $('#an-range').style.display = 'none';
    refreshChart();
  });
});
$('#an-type').addEventListener('change', refreshChart);
$('#an-apply').addEventListener('click', refreshChart);

/* ================= Budget ================= */
async function loadBudget() {
  try {
    const month = state.budgetMonth || new Date().toISOString().slice(0, 7);
    $('#bud-month').textContent = month;
    $('#bud-month-pick').value = month;
    const res = await api('/budget?month=' + month);
    const b = res.data;
    $('#bud-spent').textContent = fmt(b.totalSpent);
    $('#bud-remaining').textContent = fmt(b.remainingBudget);
    $('#bud-remaining').style.color = b.remainingBudget < 0 ? 'var(--danger)' : '';
    $('#bud-limit').textContent = fmt(b.monthlyBudget);
    const pct = b.monthlyBudget > 0 ? Math.min((b.totalSpent / b.monthlyBudget) * 100, 100) : 0;
    $('#bud-bar').style.width = pct + '%';
    $('#bud-status').textContent = b.remainingBudget < 0 ? 'Over budget ⚠️' : b.remainingBudget < b.monthlyBudget * 0.1 ? 'Nearly there' : 'On track';
    $('#bud-status').style.color = b.remainingBudget < 0 ? 'var(--danger)' : '';
    $('#bud-monthly').value = b.monthlyBudget;
    $('#bud-saving').value = b.savingGoal;
  } catch (err) { toast(err.message, true); }
}
$('#budget-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { month: $('#bud-month-pick').value, monthlyBudget: Number($('#bud-monthly').value) };
  const saving = $('#bud-saving').value;
  if (saving !== '') body.savingGoal = Number(saving);
  try {
    await api('/budget', { method: 'POST', body: JSON.stringify(body) });
    toast('Budget saved.');
    loadBudget();
    if ($('#view-dashboard').hidden === false) loadDashboard();
  } catch (err) { toast(err.message, true); }
});
$('#bud-month-pick').addEventListener('change', () => { state.budgetMonth = $('#bud-month-pick').value; loadBudget(); });

/* ================= Goals ================= */
async function loadGoals() {
  try {
    const res = await api('/goals');
    const goals = res.data;
    $('#goals-empty').hidden = goals.length > 0;
    $('#goals-grid').innerHTML = goals.map((g) => {
      const due = g.deadline ? ' · due ' + shortDate(g.deadline) : '';
      return `
        <div class="goal-card">
          <div class="goal-head">
            <h3>${esc(g.name)}</h3>
            <span class="goal-status ${g.status}">${g.status}</span>
          </div>
          <div class="goal-amt">${fmt(g.savedAmount)} <span>/ ${fmt(g.targetAmount)}</span></div>
          <div class="budget-progress ${g.progressPercent >= 100 ? 'over' : ''}"><div style="width:${g.progressPercent}%"></div></div>
          <div class="goal-meta">${g.progressPercent}% saved${due}${g.note ? ' · ' + esc(g.note) : ''}</div>
          <div class="goal-actions">
            <button class="pill pill-ghost" data-goal-add="${g.id}">+ Add savings</button>
            <button class="pill pill-ghost" data-goal-edit="${g.id}">Edit</button>
            <button class="pill pill-ghost" data-goal-del="${g.id}">Delete</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) { toast(err.message, true); }
}
$('#goals-grid').addEventListener('click', (e) => {
  const add = e.target.closest('[data-goal-add]');
  const edit = e.target.closest('[data-goal-edit]');
  const del = e.target.closest('[data-goal-del]');
  if (add) openAddSavings(Number(add.dataset.goalAdd));
  if (edit) openGoalModal(Number(edit.dataset.goalEdit));
  if (del) { if (confirm('Delete this goal?')) deleteGoal(Number(del.dataset.goalDel)); }
});

async function deleteGoal(id) {
  try { await api('/goals/' + id, { method: 'DELETE' }); toast('Goal deleted.'); loadGoals(); } catch (err) { toast(err.message, true); }
}

function openGoalModal(id = null) {
  const isEdit = !!id;
  openModal(isEdit ? 'Edit goal' : 'New savings goal', `
    <form id="goal-form" class="modal-form" novalidate>
      <div class="field"><label>Goal name</label>
        <input class="field-input" id="g-name" maxlength="80" ${isEdit ? '' : 'required'}>
      </div>
      <div class="modal-row">
        <div class="field"><label>Target amount</label>
          <input class="field-input" id="g-target" type="number" min="0.01" step="0.01" ${isEdit ? '' : 'required'}>
        </div>
        <div class="field"><label>Saved so far</label>
          <input class="field-input" id="g-saved" type="number" min="0" step="0.01">
        </div>
      </div>
      <div class="modal-row">
        <div class="field"><label>Deadline</label>
          <input class="field-input" id="g-deadline" type="date">
        </div>
        <div class="field"><label>Category</label>
          <input class="field-input" id="g-category" maxlength="50" placeholder="e.g. Vacation">
        </div>
      </div>
      <div class="field"><label>Note</label>
        <input class="field-input" id="g-note" maxlength="200" placeholder="Optional…">
      </div>
      <button class="pill pill-primary" type="submit" style="justify-content:center;">${isEdit ? 'Save goal' : 'Create goal'}</button>
    </form>`);
  const form = $('#goal-form');
  if (isEdit) {
    loadGoalForEdit(id).then((g) => {
      $('#g-name').value = g.name;
      $('#g-target').value = g.targetAmount;
      $('#g-saved').value = g.savedAmount;
      $('#g-deadline').value = g.deadline || '';
      $('#g-category').value = g.category || '';
      $('#g-note').value = g.note || '';
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#g-name').value.trim();
    const target = Number($('#g-target').value);
    const saved = $('#g-saved').value !== '' ? Number($('#g-saved').value) : undefined;
    if (name.length < 2) return toast('Please enter a goal name (min 2 characters).', true);
    if (!(target > 0)) return toast('Target amount must be greater than 0.', true);
    if (saved !== undefined && saved < 0) return toast('Saved amount cannot be negative.', true);
    const payload = {
      name,
      targetAmount: target,
      savedAmount: saved,
      deadline: $('#g-deadline').value || undefined,
      category: $('#g-category').value.trim() || undefined,
      note: $('#g-note').value.trim() || undefined,
    };
    try {
      if (isEdit) await api('/goals/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/goals', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      toast(isEdit ? 'Goal updated.' : 'Goal created! 🎯');
      loadGoals();
      renderDashGoals();
      if ($('#view-dashboard').hidden === false) loadDashboard();
    } catch (err) { toast(err.message, true); }
  });
}

async function loadGoalForEdit(id) {
  try {
    const res = await api('/goals/' + id);
    return res.data;
  } catch (err) { toast(err.message, true); throw err; }
}

function openAddSavings(id) {
  openModal('Add savings', `
    <form id="savings-form" class="modal-form">
      <div class="field"><label>Amount to add</label>
        <input class="field-input" id="s-amount" type="number" min="0.01" step="0.01" required autofocus>
      </div>
      <button class="pill pill-primary" type="submit" style="justify-content:center;">Add savings</button>
    </form>`);
  $('#savings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/goals/' + id + '/add-savings', { method: 'PATCH', body: JSON.stringify({ amount: Number($('#s-amount').value) }) });
      closeModal();
      toast('Savings added.');
      loadGoals();
      renderDashGoals();
    } catch (err) { toast(err.message, true); }
  });
}
$('#goal-add').addEventListener('click', () => openGoalModal());

/* ================= Insights ================= */
function insightCard(i) {
  const icons = { high: '🔥', medium: '⚡', low: '🌱' };
  return `
    <div class="insight-card">
      <div class="insight-icon ${i.priority}">${icons[i.priority] || '✨'}</div>
      <div class="insight-body">
        <b>${esc(i.title)}</b>
        <p>${esc(i.message)}</p>
        <div class="insight-meta">
          <span class="insight-tag">${esc(i.category)}</span>
          <span class="insight-prio">${i.priority} priority</span>
        </div>
      </div>
    </div>`;
}
async function loadInsights() {
  try {
    const res = await api('/ai/insights');
    $('#insights-list').innerHTML = res.data.length ? res.data.map(insightCard).join('') : '<div class="empty">No insights yet — add some transactions.</div>';
  } catch (err) { toast(err.message, true); }
}
$('#insights-refresh').addEventListener('click', async () => {
  try {
    await api('/ai/insights');
    loadInsights();
    toast('Insights regenerated.');
  } catch (err) { toast(err.message, true); }
});

/* ================= Notifications ================= */
async function loadNotifications() {
  try {
    const res = await api('/notifications?limit=50');
    const { notifications, unreadCount } = res.data;
    $('#notif-list').innerHTML = notifications.length
      ? notifications.map((n) => `
          <div class="notif-row ${n.isRead ? 'read' : ''}">
            <div class="notif-dot"></div>
            <div style="flex:1;">
              <b>${esc(n.title)}</b>
              <p>${esc(n.message)}</p>
            </div>
            <span class="notif-time">${timeAgo(n.createdAt)}</span>
          </div>`).join('')
      : '<div class="empty">No notifications yet.</div>';
  } catch (err) { toast(err.message, true); }
}
$('#notif-read-all').addEventListener('click', async () => {
  try {
    await api('/notifications/read', { method: 'PUT', body: JSON.stringify({}) });
    toast('All notifications marked as read.');
    loadNotifications();
  } catch (err) { toast(err.message, true); }
});
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

/* ================= Profile ================= */
async function loadProfile() {
  try {
    const res = await api('/auth/profile');
    const u = res.data;
    $('#profile-info').innerHTML = `
      <div class="profile-row"><span>Name</span><b>${esc(u.fullName)}</b></div>
      <div class="profile-row"><span>Email</span><b>${esc(u.email)}</b></div>
      <div class="profile-row"><span>Phone</span><b>${esc(u.phone || '—')}</b></div>
      <div class="profile-row"><span>Currency</span><b>${esc(u.currency)}</b></div>
      <div class="profile-row"><span>Default monthly budget</span><b>${fmt(u.monthlyBudget)}</b></div>
      <div class="profile-row"><span>Member since</span><b>${new Date(u.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>`;
    $('#pf-name').value = u.fullName;
    $('#pf-phone').value = u.phone || '';
    $('#pf-currency').value = u.currency;
    state.user = u;
    localStorage.setItem('ss_user', JSON.stringify(u));
  } catch (err) { toast(err.message, true); }
}
$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await api('/auth/update-profile', { method: 'PUT', body: JSON.stringify({ fullName: $('#pf-name').value.trim(), phone: $('#pf-phone').value.trim(), currency: $('#pf-currency').value }) });
    state.user = res.data;
    localStorage.setItem('ss_user', JSON.stringify(state.user));
    $('#nav-name').textContent = res.data.fullName;
    $('#nav-avatar').textContent = res.data.fullName.trim().charAt(0).toUpperCase();
    toast('Profile updated.');
    loadProfile();
  } catch (err) { toast(err.message, true); }
});
$('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: $('#cp-current').value, newPassword: $('#cp-new').value }) });
    $('#password-form').reset();
    toast('Password changed.');
  } catch (err) { toast(err.message, true); }
});

/* ================= Init ================= */
function sessionExpired() {
  logout();
  toast('Session expired — please log in again.', true);
}

/* ================= Theme ================= */
const THEME_KEY = 'ss_theme';
function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(THEME_KEY, theme);
  $$('.theme-toggle').forEach((btn) => {
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  });
}
function initTheme() {
  let theme = localStorage.getItem(THEME_KEY);
  if (!theme) {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  setTheme(theme);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.theme-toggle')) {
    setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }
});
initTheme();

fillSelect('tx-category', [...new Set([...CATEGORIES, ...ASSET_TYPES])]);
$('#tx-category').insertAdjacentHTML('afterbegin', '<option value="">All categories</option>');

async function tryRestoreSession() {
  try {
    const res = await api('/auth/profile');
    state.user = res.data;
    localStorage.setItem('ss_user', JSON.stringify(state.user));
    return true;
  } catch (err) {
    return err.status === 401 ? false : 'offline';
  }
}

function showSplash(message) {
  $('#splash-text').textContent = message;
  $('#splash').hidden = false;
  $('#auth-view').hidden = true;
  $('#app-view').hidden = true;
}
function hideSplash() { $('#splash').hidden = true; }

(async function init() {
  if (!state.token) return showAuth();
  showSplash('Checking your session…');
  const result = await tryRestoreSession();
  if (result === true) { hideSplash(); return showApp(); }
  if (result === false) { hideSplash(); return sessionExpired(); }

  let attempts = 0;
  const retry = async () => {
    if (!state.token) return;
    const outcome = await tryRestoreSession();
    if (outcome === false) { hideSplash(); return sessionExpired(); }
    if (outcome === true) {
      hideSplash();
      if ($('#app-view').hidden) showApp();
      return;
    }
    attempts += 1;
    if (attempts >= 4) {
      hideSplash();
      showAuth();
      toast('Reconnecting… you can log in again or wait for your session to restore.', true);
      setTimeout(retry, 10000);
      return;
    }
    showSplash('Reconnecting to SpendSnap AI…');
    setTimeout(retry, 2500 * attempts);
  };
  setTimeout(retry, 2500);
})();
