const { Router } = require('express');
const action = require('../lib/action');
const { ApiError } = require('../lib/api');
const { qs } = require('../lib/helpers');
const { requireLogin, requireRole } = require('../middleware/session');

const router = Router();
router.use(requireLogin);

// Only numeric ids are passed on to the API
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(404).render('error', { title: 'Not found', status: 404, message: 'That request does not exist.' });
  next();
});

const FILTER_KEYS = ['status', 'priority', 'category_id', 'assigned_to', 'search', 'sort', 'page'];
const isReporter = (user) => user.role === 'student' || user.role === 'staff';
const backToRequest = (req) => `/requests/${req.params.id}`;

// GET /requests - list with filters (scoped by role in the API)
router.get('/', async (req, res) => {
  const filters = Object.fromEntries(FILTER_KEYS.filter((k) => req.query[k]).map((k) => [k, String(req.query[k])]));
  const isAdmin = req.user.role === 'admin';

  const [list, { categories }, staff] = await Promise.all([
    req.api('GET', qs('/requests', { ...filters, limit: 15 })),
    req.api('GET', '/categories'),
    isAdmin ? req.api('GET', '/users?role=maintenance') : Promise.resolve({ users: [] }),
  ]);

  res.render('requests/list', {
    title: isReporter(req.user) ? 'My requests' : req.user.role === 'maintenance' ? 'My work' : 'All requests',
    list,
    filters,
    categories,
    staff: staff.users,
  });
});

// GET /requests/new - report a problem (students and college staff)
router.get('/new', requireRole('student', 'staff'), async (req, res) => {
  const { categories } = await req.api('GET', '/categories');
  res.render('requests/form', { title: 'Report a problem', mode: 'new', categories, values: { priority: 'Medium' }, errors: {}, error: null });
});

router.post('/new', requireRole('student', 'staff'), async (req, res) => {
  const values = pickRequestFields(req.body);
  try {
    const { request } = await req.api('POST', '/requests', values);
    res.flash('success', `Request #${request.id} submitted. The maintenance office has been notified.`);
    res.redirect(`/requests/${request.id}`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500 || err.status === 401) throw err;
    const { categories } = await req.api('GET', '/categories');
    res.status(err.status).render('requests/form', {
      title: 'Report a problem', mode: 'new', categories, values, errors: err.fieldErrors, error: err.details.length ? null : err.readable,
    });
  }
});

// GET /requests/:id - details, status timeline and the actions this user may take
router.get('/:id', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const [{ request, history }, staff] = await Promise.all([
    req.api('GET', `/requests/${req.params.id}`),
    isAdmin ? req.api('GET', '/users?role=maintenance') : Promise.resolve({ users: [] }),
  ]);

  const isOwner = request.reporter_id === req.user.id;
  const isAssignee = request.assigned_to === req.user.id;
  const nextSteps = { Assigned: 'In Progress', 'In Progress': 'Completed' };

  res.render('requests/detail', {
    title: `#${request.id} ${request.title}`,
    request,
    history,
    staff: staff.users,
    can: {
      edit: isAdmin || (isOwner && request.status === 'Pending'),
      assign: isAdmin && request.status !== 'Completed',
      advance: req.user.role === 'maintenance' && isAssignee ? nextSteps[request.status] || null : null,
      setAnyStatus: isAdmin,
      remove: isAdmin,
    },
  });
});

router.get('/:id/edit', async (req, res) => {
  const [{ request }, { categories }] = await Promise.all([
    req.api('GET', `/requests/${req.params.id}`),
    req.api('GET', '/categories'),
  ]);
  if (req.user.role !== 'admin' && !(request.reporter_id === req.user.id && request.status === 'Pending')) {
    res.flash('error', 'This request can no longer be edited.');
    return res.redirect(`/requests/${request.id}`);
  }
  res.render('requests/form', { title: `Edit #${request.id}`, mode: 'edit', request, categories, values: request, errors: {}, error: null });
});

router.post('/:id/edit', async (req, res) => {
  const values = pickRequestFields(req.body);
  try {
    await req.api('PUT', `/requests/${req.params.id}`, values);
    res.flash('success', 'Request updated.');
    res.redirect(`/requests/${req.params.id}`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500 || err.status === 401) throw err;
    if (err.status !== 400) {
      res.flash('error', err.readable);
      return res.redirect(`/requests/${req.params.id}`);
    }
    const [{ request }, { categories }] = await Promise.all([
      req.api('GET', `/requests/${req.params.id}`),
      req.api('GET', '/categories'),
    ]);
    res.status(400).render('requests/form', {
      title: `Edit #${request.id}`, mode: 'edit', request, categories, values, errors: err.fieldErrors, error: err.details.length ? null : err.readable,
    });
  }
});

router.post('/:id/assign', requireRole('admin'), action(backToRequest, async (req, res) => {
  const { request } = await req.api('PATCH', `/requests/${req.params.id}/assign`, { staff_id: Number(req.body.staff_id) });
  res.flash('success', `Assigned to ${request.assigned_name}. They have been notified.`);
  res.redirect(backToRequest(req));
}));

router.post('/:id/status', requireRole('maintenance', 'admin'), action(backToRequest, async (req, res) => {
  const { request } = await req.api('PATCH', `/requests/${req.params.id}/status`, {
    status: req.body.status,
    note: req.body.note || undefined,
  });
  res.flash('success', request.status === 'Completed'
    ? 'Marked as completed. The reporter has been told the problem is resolved.'
    : `Status changed to ${request.status}.`);
  res.redirect(backToRequest(req));
}));

router.post('/:id/delete', requireRole('admin'), action(backToRequest, async (req, res) => {
  await req.api('DELETE', `/requests/${req.params.id}`);
  res.flash('success', `Request #${req.params.id} deleted.`);
  res.redirect('/requests');
}));

function pickRequestFields(body) {
  return {
    title: body.title || '',
    description: body.description || '',
    location: body.location || '',
    category_id: body.category_id ? Number(body.category_id) : '',
    priority: body.priority || 'Medium',
  };
}

module.exports = router;
