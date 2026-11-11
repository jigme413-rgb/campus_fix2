const Notification = require('../models/notificationModel');
const { notFound } = require('../utils/httpError');

// GET /api/notifications?unread=true
async function list(req, res) {
  const unreadOnly = req.query.unread === 'true';
  const [notifications, unread] = await Promise.all([
    Notification.findByUser(req.user.id, { unreadOnly }),
    Notification.unreadCount(req.user.id),
  ]);
  res.json({ notifications, unread });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const notification = await Notification.markRead(req.params.id, req.user.id);
  if (!notification) throw notFound('Notification not found');
  res.json({ notification });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  res.json({ updated: await Notification.markAllRead(req.user.id) });
}

module.exports = { list, markRead, markAllRead };
