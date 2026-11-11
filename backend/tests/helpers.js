// Shared helpers for integration tests.
const bcrypt = require('bcryptjs');
const User = require('../src/models/userModel');
const Category = require('../src/models/categoryModel');
const { signToken } = require('../src/middleware/auth');

let counter = 0;
const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${++counter}@test.sherubtse.edu.bt`;

/** Creates a user directly in the database and returns { user, token, auth } */
async function createUser(role = 'student', name = `Test ${role}`) {
  const user = await User.create({
    name,
    email: uniqueEmail(role),
    passwordHash: await bcrypt.hash('Password1', 4),
    role,
  });
  const token = signToken(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

async function anyCategoryId() {
  const categories = await Category.findAll();
  return categories[0].id;
}

const validRequest = (categoryId, overrides = {}) => ({
  title: 'Broken classroom light',
  description: 'The tube light at the front of the room does not switch on.',
  location: 'Academic Block A, Room 101',
  category_id: categoryId,
  priority: 'High',
  ...overrides,
});

module.exports = { uniqueEmail, createUser, anyCategoryId, validRequest };
