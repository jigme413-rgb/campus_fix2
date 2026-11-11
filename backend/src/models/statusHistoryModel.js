const db = require('../config/db');

async function create({ request_id, old_status = null, new_status, changed_by = null, note = null }) {
  const { rows } = await db.query(
    `INSERT INTO status_history (request_id, old_status, new_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [request_id, old_status, new_status, changed_by, note]
  );
  return rows[0];
}

async function findByRequest(requestId) {
  const { rows } = await db.query(
    `SELECT h.*, u.name AS changed_by_name, u.role AS changed_by_role
       FROM status_history h
       LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.request_id = $1
      ORDER BY h.changed_at ASC, h.id ASC`,
    [requestId]
  );
  return rows;
}

module.exports = { create, findByRequest };
