const asyncHandler = require('../utils/asyncHandler');
const { getOrCreateMonthlyReport, getReportStateForUser } = require('../services/monthlyReportService');
const { monthName } = require('../services/monthlyReportService');

const formatMonthForFilename = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'Month';
  const [year, month] = monthKey.split('-').map(Number);
  const monthNameLabel = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  return `SpendSnap_${monthNameLabel}_${year}.csv`;
};

const getCurrentMonthlyReport = asyncHandler(async (req, res) => {
  const state = getReportStateForUser(req.userId, new Date());

  if (!state.shouldShow || !state.report) {
    return res.json({
      success: true,
      data: {
        month: state.month,
        shouldShow: false,
        pending: state.pending || false,
        report: null,
        nextMonth: state.nextMonth,
      },
    });
  }

  return res.json({
    success: true,
    data: {
      month: state.month,
      shouldShow: true,
      pending: state.pending || false,
      report: state.report,
      nextMonth: state.nextMonth,
      downloadUrl: `/api/monthly-report/download?month=${encodeURIComponent(state.month)}`,
    },
  });
});

const downloadMonthlyReport = asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const report = getOrCreateMonthlyReport(req.userId, month);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${formatMonthForFilename(month)}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.send(report.csvData || '');
});

module.exports = { getCurrentMonthlyReport, downloadMonthlyReport };
