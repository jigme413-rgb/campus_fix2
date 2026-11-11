const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { signToken } = require('../middleware/auth');
const { conflict, unauthorized } = require('../utils/httpError');

// POST /api/auth/register  (public: students and college staff sign themselves up)
async function register(req, res) {
  const { name, email, password, role } = req.body; // already validated
  if (await User.findByEmailWithHash(email)) throw conflict('Email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ user, token: signToken(user) });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  const record = await User.findByEmailWithHash(email);
  // Same message whether the email or the password is wrong, so accounts cannot be probed
  if (!record || !(await bcrypt.compare(password, record.password_hash))) {
    throw unauthorized('Invalid email or password');
  }
  const user = await User.findById(record.id);
  res.json({ user, token: signToken(user) });
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
