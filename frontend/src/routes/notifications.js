const { Router } = require('express');
const action = require('../lib/action');
const { requireLogin } = require('../middleware/session');

const router = Router();
router.use(requireLogin);

router.get('/', async (req, res) => {
  const { notifications } = await req.api('GET', '/notifications');
  res.render('notifications', { title: 'Notifications', notifications });
});

router.post('/read-all', action('/notifications', async (req, res) => {
  await req.api('PATCH', '/notifications/read-all');
  res.redirect('/notifications');
}));

// Opening a notification marks it read and jumps to its request
router.post('/:id/open', action('/notifications', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.redirect('/notifications');
  const { notification } = await req.api('PATCH', `/notifications/${req.params.id}/read`);
  res.redirect(notification.request_id ? `/requests/${notification.request_id}` : '/notifications');
}));

module.exports = router;
