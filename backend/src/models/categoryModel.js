const db = require('../config/db');

async function findAll() {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.created_at, COUNT(r.id)::int AS request_count
       FROM categories c
       LEFT JOIN requests r ON r.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT id, name, created_at FROM categories WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByName(name) {
  const { rows } = await db.query('SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
  return rows[0] || null;
}

async function create(name) {
  const { rows } = await db.query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at', [name]);
  return rows[0];
}

async function update(id, name) {
  const { rows } = await db.query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
    [name, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { findAll, findById, findByName, create, update, remove };
