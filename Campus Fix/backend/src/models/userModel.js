const db = require('../config/db');

// Columns that are safe to send to clients (never the password hash)
const PUBLIC_COLUMNS = 'id, name, email, role, created_at';

async function create({ name, email, passwordHash, role = 'student' }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, LOWER($2), $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

// Includes password_hash: only used by the login controller
async function findByEmailWithHash(email) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = LOWER($1)', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findAll({ role } = {}) {
  const params = [];
  let where = '';
  if (role) {
    params.push(role);
    where = 'WHERE u.role = $1';
  }
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            (SELECT COUNT(*)::int FROM requests r
              WHERE r.assigned_to = u.id AND r.status <> 'Completed') AS open_assignments
       FROM users u
       ${where}
      ORDER BY u.role, u.name`,
    params
  );
  return rows;
}

async function findIdsByRole(role) {
  const { rows } = await db.query('SELECT id FROM users WHERE role = $1', [role]);
  return rows.map((r) => r.id);
}

async function updateRole(id, role) {
  const { rows } = await db.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [role, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { create, findByEmailWithHash, findById, findAll, findIdsByRole, updateRole, remove };
