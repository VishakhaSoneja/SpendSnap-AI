const notificationModel = require('../models/notificationModel');
const asyncHandler = require('../utils/asyncHandler');
const { markRead } = require('../services/notificationService');

/**
 * GET /api/notifications?limit=&page=&unreadOnly=
 */
const listNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const unreadOnly = req.query.unreadOnly === 'true';

  const notifications = notificationModel.list(req.userId, {
    limit,
    offset: (page - 1) * limit,
    unreadOnly,
  });
  const total = notificationModel.count(req.userId, { unreadOnly });
  const unreadCount = notificationModel.countUnread(req.userId);

  return res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

/**
 * PUT /api/notifications/read
 * Body: { id? } — mark one notification or all as read.
 */
const markNotificationsRead = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const updated = markRead(req.userId, id);
  return res.json({ success: true, message: `Marked ${updated} notification(s) as read.` });
});

module.exports = { listNotifications, markNotificationsRead };
