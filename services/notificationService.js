const notificationModel = require('../models/notificationModel');

/**
 * Creates a notification for a user.
 */
const createNotification = (userId, { title, message, type = 'info' }) => {
  if (!title || !message) return null;
  return notificationModel.create(userId, { title, message, type });
};

/**
 * Marks notifications as read. Pass id to mark a single notification,
 * otherwise marks all of the user's notifications.
 * @returns {number} number of rows updated
 */
const markRead = (userId, id) => notificationModel.markRead(userId, id);

module.exports = { createNotification, markRead };
