const Request = require('../models/requestModel');
const Category = require('../models/categoryModel');
const User = require('../models/userModel');
const StatusHistory = require('../models/statusHistoryModel');
const { eventBus, EVENTS } = require('../events/eventBus');
const { badRequest, forbidden, notFound } = require('../utils/httpError');
const { STATUSES, PRIORITIES, isPositiveInt, canTransition } = require('../utils/validators');

const isReporter = (user) => user.role === 'student' || user.role === 'staff';

// Who may see a request: admins, its reporter, and the maintenance staff it is assigned to
function canView(user, request) {
  if (user.role === 'admin') return true;
  if (isReporter(user)) return request.reporter_id === user.id;
  if (user.role === 'maintenance') return request.assigned_to === user.id;
  return false;
}

async function loadRequest(id) {
  const request = await Request.findById(id);
  if (!request) throw notFound('Maintenance request not found');
  return request;
}

async function ensureCategory(categoryId) {
  if (categoryId !== undefined && !(await Category.findById(categoryId))) {
    throw badRequest('Validation failed', [{ field: 'category_id', message: 'Category does not exist' }]);
  }
}

// POST /api/requests  (FR2)
async function create(req, res) {
  await ensureCategory(req.body.category_id);
  const created = await Request.create({ ...req.body, reporter_id: req.user.id });
  const request = await Request.findById(created.id);

  await eventBus.emitAsync(EVENTS.REQUEST_CREATED, { request, actor: req.user });
  res.status(201).json({ request });
}

// GET /api/requests  (FR3, FR4) - results are scoped by role
async function list(req, res) {
  const q = req.query;
  const errors = [];
  if (q.status && !STATUSES.includes(q.status)) errors.push({ field: 'status', message: 'Unknown status' });
  if (q.priority && !PRIORITIES.includes(q.priority)) errors.push({ field: 'priority', message: 'Unknown priority' });
  if (q.category_id && !isPositiveInt(q.category_id)) errors.push({ field: 'category_id', message: 'Invalid category' });
  if (q.assigned_to && !isPositiveInt(q.assigned_to)) errors.push({ field: 'assigned_to', message: 'Invalid staff id' });
  if (errors.length) throw badRequest('Invalid filter', errors);

  const filters = {
    status: q.status,
    priority: q.priority,
    category_id: q.category_id,
    search: typeof q.search === 'string' ? q.search.trim().slice(0, 100) : undefined,
    sort: q.sort,
    page: q.page,
    limit: q.limit,
  };

  if (isReporter(req.user)) filters.reporter_id = req.user.id;
  else if (req.user.role === 'maintenance') filters.assigned_to = req.user.id;
  else if (q.assigned_to) filters.assigned_to = q.assigned_to;

  res.json(await Request.findAll(filters));
}

// GET /api/requests/:id  - includes the full status history
async function getOne(req, res) {
  const request = await loadRequest(req.params.id);
  if (!canView(req.user, request)) throw forbidden('You cannot view this request');
  const history = await StatusHistory.findByRequest(request.id);
  res.json({ request, history });
}

// PUT /api/requests/:id  - reporter (while still Pending) or admin
async function update(req, res) {
  const request = await loadRequest(req.params.id);
  const isOwner = request.reporter_id === req.user.id;

  if (req.user.role !== 'admin') {
    if (!isOwner) throw forbidden('Only the reporter or an administrator can edit this request');
    if (request.status !== 'Pending') throw forbidden('Requests can only be edited while they are Pending');
  }

  await ensureCategory(req.body.category_id);
  const updated = await Request.update(request.id, req.body);
  res.json({ request: updated });
}

// PATCH /api/requests/:id/assign  (FR5) - admin only
async function assign(req, res) {
  const staffId = req.body.staff_id ?? req.body.assigned_to;
  if (!isPositiveInt(staffId)) {
    throw badRequest('Validation failed', [{ field: 'staff_id', message: 'Choose a maintenance staff member' }]);
  }

  const request = await loadRequest(req.params.id);
  if (request.status === 'Completed') throw badRequest('Completed requests cannot be reassigned. Reopen it first.');

  const staff = await User.findById(Number(staffId));
  if (!staff || staff.role !== 'maintenance') {
    throw badRequest('Validation failed', [{ field: 'staff_id', message: 'User is not a maintenance staff member' }]);
  }

  const previousStatus = request.status;
  const updated = await Request.assign(request.id, staff.id);

  await eventBus.emitAsync(EVENTS.REQUEST_ASSIGNED, {
    request: updated,
    staff,
    actor: req.user,
    previousStatus,
  });
  res.json({ request: updated });
}

// PATCH /api/requests/:id/status  (FR6) - assigned maintenance staff or admin
async function updateStatus(req, res) {
  const { status: newStatus, note } = req.body;
  const request = await loadRequest(req.params.id);

  if (req.user.role === 'maintenance' && request.assigned_to !== req.user.id) {
    throw forbidden('You can only update requests assigned to you');
  }
  if (!canTransition(req.user.role, request.status, newStatus)) {
    throw badRequest(`Cannot change status from ${request.status} to ${newStatus}`);
  }
  if (newStatus !== 'Pending' && !request.assigned_to) {
    throw badRequest('Assign the request to a maintenance staff member first');
  }

  const previousStatus = request.status;
  const updated = await Request.updateStatus(request.id, newStatus);
  const payload = { request: updated, previousStatus, newStatus, actor: req.user, note };

  await eventBus.emitAsync(EVENTS.REQUEST_STATUS_UPDATED, payload);
  if (newStatus === 'Completed') await eventBus.emitAsync(EVENTS.REQUEST_COMPLETED, payload);

  res.json({ request: updated });
}

// DELETE /api/requests/:id - admin only
async function remove(req, res) {
  const deleted = await Request.remove(req.params.id);
  if (!deleted) throw notFound('Maintenance request not found');
  res.json({ message: 'Request deleted' });
}

module.exports = { create, list, getOne, update, assign, updateStatus, remove, canView };
