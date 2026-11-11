const { Router } = require('express');
const db = require('../config/db');
const stats = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Health check used by Render and the frontend
router.get('/health', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok', service: 'campusfix-api', time: new Date().toISOString() });
});

router.use('/auth', require('./authRoutes'));
router.use('/requests', require('./requestRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/notifications', require('./notificationRoutes'));

router.get('/stats', authenticate, authorize('admin'), stats.overview);
router.get('/events', authenticate, authorize('admin'), stats.recentEvents);

module.exports = router;
