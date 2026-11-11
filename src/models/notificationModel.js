const db = require('../config/db');

async function create({ user_id, request_id = null, type, message }) {
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, request_id, type, message)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [user_id, request_id, type, message]
  );
  return rows[0];
}

// One notification per user, inserted in a single statement
async function createForUsers(userIds, { request_id = null, type, message }) {
  if (!userIds.length) return [];
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, request_id, type, message)
     SELECT UNNEST($1::int[]), $2, $3, $4
     RETURNING *`,
    [userIds, request_id, type, message]
  );
  return rows;
}

async function findByUser(userId, { unreadOnly = false, limit = 30 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM notifications
      WHERE user_id = $1 ${unreadOnly ? 'AND is_read = FALSE' : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function unreadCount(userId) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return rows[0].count;
}

async function markRead(id, userId) {
  const { rows } = await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return rows[0] || null;
}

async function markAllRead(userId) {
  const { rowCount } = await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return rowCount;
}

module.exports = { create, createForUsers, findByUser, unreadCount, markRead, markAllRead };
