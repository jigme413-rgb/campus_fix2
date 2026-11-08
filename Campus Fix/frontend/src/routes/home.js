const { Router } = require('express');
const { requireLogin } = require('../middleware/session');

const router = Router();

router.get('/', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/dashboard');
  res.render('landing', { title: null });
});

// Personal dashboard for reporters and maintenance staff (admins have /admin)
router.get('/dashboard', requireLogin, async (req, res) => {
  if (req.user.role === 'admin') return res.redirect('/admin');

  const isMaintenance = req.user.role === 'maintenance';
  const [{ requests }, { notifications }] = await Promise.all([
    req.api('GET', `/requests?limit=100&sort=${isMaintenance ? 'priority' : 'updated'}`),
    req.api('GET', '/notifications'),
  ]);

  const counts = { Pending: 0, Assigned: 0, 'In Progress': 0, Completed: 0 };
  requests.forEach((r) => { counts[r.status] += 1; });

  res.render('dashboard', {
    title: 'Dashboard',
    counts,
    total: requests.length,
    active: requests.filter((r) => r.status !== 'Completed').slice(0, isMaintenance ? 20 : 6),
    recentlyDone: requests.filter((r) => r.status === 'Completed').slice(0, 4),
    notifications: notifications.slice(0, 5),
  });
});

module.exports = router;
