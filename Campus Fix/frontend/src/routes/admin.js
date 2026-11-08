const { Router } = require('express');
const action = require('../lib/action');
const { ApiError } = require('../lib/api');
const { requireRole } = require('../middleware/session');

const router = Router();
router.use(requireRole('admin'));

router.param('id', (req, res, next, id) => (/^\d+$/.test(id) ? next() : res.redirect('/admin')));

// GET /admin - overview: counts, queue, workload, recurring problems, live event log
router.get('/', async (req, res) => {
  const [{ stats }, { events }, waiting] = await Promise.all([
    req.api('GET', '/stats'),
    req.api('GET', '/events'),
    req.api('GET', '/requests?status=Pending&sort=priority&limit=6'),
  ]);
  res.render('admin/dashboard', { title: 'Admin overview', stats, events: events.slice(0, 12), waiting });
});

// ---- Users ----
router.get('/users', async (req, res) => {
  const role = ['student', 'staff', 'maintenance', 'admin'].includes(req.query.role) ? req.query.role : '';
  const { users } = await req.api('GET', `/users${role ? `?role=${role}` : ''}`);
  res.render('admin/users', { title: 'Users', users, role, values: { role: 'maintenance' }, errors: {} });
});

router.post('/users', async (req, res) => {
  const values = { name: req.body.name || '', email: req.body.email || '', password: req.body.password || '', role: req.body.role || 'maintenance' };
  try {
    const { user } = await req.api('POST', '/users', values);
    res.flash('success', `Account created for ${user.name}.`);
    res.redirect('/admin/users');
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500 || err.status === 401) throw err;
    const { users } = await req.api('GET', '/users');
    const errors = err.fieldErrors;
    if (err.status === 409) errors.email = 'This email is already registered.';
    res.status(err.status).render('admin/users', { title: 'Users', users, role: '', values: { ...values, password: '' }, errors });
  }
});

router.post('/users/:id/role', action('/admin/users', async (req, res) => {
  const { user } = await req.api('PATCH', `/users/${req.params.id}/role`, { role: req.body.role });
  res.flash('success', `${user.name} is now ${user.role === 'admin' ? 'an' : 'a'} ${user.role}.`);
  res.redirect('/admin/users');
}));

router.post('/users/:id/delete', action('/admin/users', async (req, res) => {
  await req.api('DELETE', `/users/${req.params.id}`);
  res.flash('success', 'User deleted.');
  res.redirect('/admin/users');
}));

// ---- Categories ----
router.get('/categories', async (req, res) => {
  const { categories } = await req.api('GET', '/categories');
  res.render('admin/categories', { title: 'Categories', categories });
});

router.post('/categories', action('/admin/categories', async (req, res) => {
  const { category } = await req.api('POST', '/categories', { name: req.body.name || '' });
  res.flash('success', `Category "${category.name}" added.`);
  res.redirect('/admin/categories');
}));

router.post('/categories/:id', action('/admin/categories', async (req, res) => {
  await req.api('PUT', `/categories/${req.params.id}`, { name: req.body.name || '' });
  res.flash('success', 'Category renamed.');
  res.redirect('/admin/categories');
}));

router.post('/categories/:id/delete', action('/admin/categories', async (req, res) => {
  await req.api('DELETE', `/categories/${req.params.id}`);
  res.flash('success', 'Category deleted. Its requests are now uncategorised.');
  res.redirect('/admin/categories');
}));

module.exports = router;
