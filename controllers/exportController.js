const transactionModel = require('../models/transactionModel');
const asyncHandler = require('../utils/asyncHandler');
const { buildCsv } = require('../exports/csvExport');
const { dateKey, monthKey, monthRange } = require('../utils/constants');

const csvFields = [
  { label: 'Date', value: 'date' },
  { label: 'Type', value: 'type' },
  { label: 'Category', value: 'category' },
  { label: 'Amount', value: 'amount' },
  { label: 'Payment Method', value: 'paymentMethod' },
  { label: 'Note', value: 'note' },
  { label: 'Receipt', value: 'receipt' },
  { label: 'Transaction ID', value: 'id' },
];

/**
 * GET /api/export/csv?type=&category=&paymentMethod=&from=&to=&month=&q=
 * Streams the user's transactions as a downloadable CSV attachment.
 */
const exportCsv = asyncHandler(async (req, res) => {
  const { type, category, paymentMethod, from, to, month, q } = req.query;

  let range = {};
  if (from || to) {
    range.from = from ? dateKey(new Date(from)) : undefined;
    range.to = to ? dateKey(new Date(to)) : undefined;
  } else if (month) {
    const [year, m] = month.split('-').map(Number);
    if (Number.isFinite(year) && Number.isFinite(m)) {
      const { start, end } = monthRange(`${year}-${String(m).padStart(2, '0')}`);
      range.from = dateKey(start);
      range.to = dateKey(new Date(end.getTime() - 1));
    }
  }

  const { transactions } = transactionModel.list(req.userId, {
    type,
    category,
    paymentMethod,
    month: range.from ? undefined : month,
    q,
    ...range,
    page: 1,
    limit: 5000,
    sort: '-date',
  });

  const csv = buildCsv(transactions, csvFields);

  const stamp = month || dateKey();
  const filename = `spendsnap-transactions-${stamp}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.send(csv);
});

module.exports = { exportCsv, csvFields };
