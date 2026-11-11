const db = require('../config/db');

// Request row plus the human-readable names the frontend needs
const SELECT_WITH_NAMES = `
  SELECT r.*,
         c.name  AS category_name,
         rep.name AS reporter_name, rep.email AS reporter_email,
         asg.name AS assigned_name
    FROM requests r
    LEFT JOIN categories c ON c.id = r.category_id
    JOIN users rep        ON rep.id = r.reporter_id
    LEFT JOIN users asg   ON asg.id = r.assigned_to`;

const SORTS = {
  newest: 'r.created_at DESC',
  oldest: 'r.created_at ASC',
  updated: 'r.updated_at DESC',
  // Urgent first, then by age
  priority: `CASE r.priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, r.created_at ASC`,
};

async function create({ title, description, location, priority, category_id, reporter_id }) {
  const { rows } = await db.query(
    `INSERT INTO requests (title, description, location, priority, category_id, reporter_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, description, location, priority, category_id, reporter_id]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query(`${SELECT_WITH_NAMES} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Lists requests. Every filter is optional and is added as a parameter, never
 * concatenated into the SQL string.
 */
async function findAll(filters = {}) {
  const conditions = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replace('?', `$${params.length}`));
  };

  if (filters.reporter_id) add('r.reporter_id = ?', filters.reporter_id);
  if (filters.assigned_to) add('r.assigned_to = ?', filters.assigned_to);
  if (filters.status) add('r.status = ?', filters.status);
  if (filters.priority) add('r.priority = ?', filters.priority);
  if (filters.category_id) add('r.category_id = ?', filters.category_id);
  if (filters.search) {
    // One parameter, reused for all three columns
    params.push(`%${filters.search}%`);
    const n = params.length;
    conditions.push(`(r.title ILIKE $${n} OR r.description ILIKE $${n} OR r.location ILIKE $${n})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = SORTS[filters.sort] || SORTS.newest;
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const page = Math.max(Number(filters.page) || 1, 1);

  const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM requests r ${where}`, params);
  const { rows } = await db.query(
    `${SELECT_WITH_NAMES} ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  const total = countResult.rows[0].total;
  return { requests: rows, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) };
}

async function update(id, fields) {
  const allowed = ['title', 'description', 'location', 'priority', 'category_id'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return findById(id);
  params.push(id);
  await db.query(`UPDATE requests SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  return findById(id);
}

async function assign(id, staffId) {
  await db.query(
    `UPDATE requests SET assigned_to = $1, status = 'Assigned', updated_at = NOW(), completed_at = NULL
      WHERE id = $2`,
    [staffId, id]
  );
  return findById(id);
}

async function updateStatus(id, status) {
  await db.query(
    `UPDATE requests
        SET status = $1::varchar,
            updated_at = NOW(),
            completed_at = CASE WHEN $1::varchar = 'Completed' THEN NOW() ELSE NULL END,
            -- Moving back to Pending releases the assignment
            assigned_to = CASE WHEN $1::varchar = 'Pending' THEN NULL ELSE assigned_to END
      WHERE id = $2`,
    [status, id]
  );
  return findById(id);
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM requests WHERE id = $1', [id]);
  return rowCount > 0;
}

// Figures for the admin dashboard: workload, recurring problems and response times
async function stats() {
  const [byStatus, byCategory, byPriority, resolution, workload, hotspots] = await Promise.all([
    db.query(`SELECT status, COUNT(*)::int AS count FROM requests GROUP BY status`),
    db.query(
      `SELECT COALESCE(c.name, 'Uncategorised') AS category, COUNT(r.id)::int AS count
         FROM requests r LEFT JOIN categories c ON c.id = r.category_id
        GROUP BY c.name ORDER BY count DESC`
    ),
    db.query(`SELECT priority, COUNT(*)::int AS count FROM requests WHERE status <> 'Completed' GROUP BY priority`),
    db.query(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)::numeric, 1)::float AS avg_hours
         FROM requests WHERE completed_at IS NOT NULL`
    ),
    db.query(
      `SELECT u.id, u.name,
              COUNT(r.id) FILTER (WHERE r.status IN ('Assigned', 'In Progress'))::int AS open,
              COUNT(r.id) FILTER (WHERE r.status = 'Completed')::int AS completed
         FROM users u LEFT JOIN requests r ON r.assigned_to = u.id
        WHERE u.role = 'maintenance'
        GROUP BY u.id ORDER BY open DESC, u.name`
    ),
    db.query(
      `SELECT location, COUNT(*)::int AS count FROM requests
        GROUP BY location HAVING COUNT(*) > 1 ORDER BY count DESC LIMIT 5`
    ),
  ]);

  const statusCounts = { Pending: 0, Assigned: 0, 'In Progress': 0, Completed: 0 };
  byStatus.rows.forEach((r) => { statusCounts[r.status] = r.count; });

  return {
    total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    by_status: statusCounts,
    by_category: byCategory.rows,
    open_by_priority: byPriority.rows,
    avg_resolution_hours: resolution.rows[0].avg_hours,
    staff_workload: workload.rows,
    recurring_locations: hotspots.rows,
  };
}

module.exports = { create, findById, findAll, update, assign, updateStatus, remove, stats };
