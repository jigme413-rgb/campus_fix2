const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { ROLES } = require('../utils/validators');
const { badRequest, conflict, notFound } = require('../utils/httpError');

// GET /api/users?role=maintenance (admin)
async function list(req, res) {
  const { role } = req.query;
  if (role && !ROLES.includes(role)) throw badRequest('Unknown role');
  res.json({ users: await User.findAll({ role }) });
}

// POST /api/users (admin) - the only way to create maintenance and admin accounts
async function create(req, res) {
  const { name, email, password, role } = req.body;
  if (await User.findByEmailWithHash(email)) throw conflict('Email is already registered');
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role });
  res.status(201).json({ user });
}

// PATCH /api/users/:id/role (admin)
async function updateRole(req, res) {
  const { role } = req.body || {};
  if (!ROLES.includes(role)) {
    throw badRequest('Validation failed', [{ field: 'role', message: `Role must be one of: ${ROLES.join(', ')}` }]);
  }
  if (req.params.id === req.user.id) throw badRequest('You cannot change your own role');
  const user = await User.updateRole(req.params.id, role);
  if (!user) throw notFound('User not found');
  res.json({ user });
}

// DELETE /api/users/:id (admin)
async function remove(req, res) {
  if (req.params.id === req.user.id) throw badRequest('You cannot delete your own account');
  if (!(await User.remove(req.params.id))) throw notFound('User not found');
  res.json({ message: 'User deleted' });
}

module.exports = { list, create, updateRole, remove };
