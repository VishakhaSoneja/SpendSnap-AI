const asyncHandler = require('../utils/asyncHandler');
const { generateInsights } = require('../services/aiService');

/**
 * GET /api/ai/insights
 * Regenerates today's rule-based insights (deduplicated) and returns the
 * 10 most recent stored insights for the user.
 */
const getInsights = asyncHandler(async (req, res) => {
  const insights = generateInsights(req.userId);
  return res.json({ success: true, data: insights });
});

module.exports = { getInsights };
