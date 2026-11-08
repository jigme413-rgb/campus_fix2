const Category = require('../models/categoryModel');
const { conflict, notFound } = require('../utils/httpError');

// GET /api/categories
async function list(req, res) {
  res.json({ categories: await Category.findAll() });
}

// POST /api/categories (admin)
async function create(req, res) {
  if (await Category.findByName(req.body.name)) throw conflict('A category with this name already exists');
  res.status(201).json({ category: await Category.create(req.body.name) });
}

// PUT /api/categories/:id (admin)
async function update(req, res) {
  const existing = await Category.findByName(req.body.name);
  if (existing && existing.id !== req.params.id) throw conflict('A category with this name already exists');
  const category = await Category.update(req.params.id, req.body.name);
  if (!category) throw notFound('Category not found');
  res.json({ category });
}

// DELETE /api/categories/:id (admin) - requests in it become uncategorised
async function remove(req, res) {
  if (!(await Category.remove(req.params.id))) throw notFound('Category not found');
  res.json({ message: 'Category deleted' });
}

module.exports = { list, create, update, remove };
