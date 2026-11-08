const { Router } = require('express');
const controller = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateIdParam } = require('../middleware/validate');
const { validateCategory } = require('../utils/validators');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize('admin'), validateBody(validateCategory), controller.create);
router.put('/:id', validateIdParam, authorize('admin'), validateBody(validateCategory), controller.update);
router.delete('/:id', validateIdParam, authorize('admin'), controller.remove);

module.exports = router;
