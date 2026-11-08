const { Router } = require('express');
const controller = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateIdParam } = require('../middleware/validate');
const { validateRequest, validateStatus } = require('../utils/validators');

const router = Router();

router.use(authenticate); // every request route needs a valid token

router
  .route('/')
  .get(controller.list)
  .post(authorize('student', 'staff'), validateBody(validateRequest), controller.create);

router
  .route('/:id')
  .all(validateIdParam)
  .get(controller.getOne)
  .put(validateBody(validateRequest, { partial: true }), controller.update)
  .delete(authorize('admin'), controller.remove);

router.patch('/:id/assign', validateIdParam, authorize('admin'), controller.assign);
router.patch(
  '/:id/status',
  validateIdParam,
  authorize('maintenance', 'admin'),
  validateBody(validateStatus),
  controller.updateStatus
);

module.exports = router;
