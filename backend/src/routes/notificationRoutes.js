const { Router } = require('express');
const controller = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', validateIdParam, controller.markRead);

module.exports = router;
