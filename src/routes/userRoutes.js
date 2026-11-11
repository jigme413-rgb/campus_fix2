const { Router } = require('express');
const controller = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateIdParam } = require('../middleware/validate');
const { validateRegistration, ROLES } = require('../utils/validators');

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', controller.list);
router.post('/', validateBody(validateRegistration, { allowedRoles: ROLES }), controller.create);
router.patch('/:id/role', validateIdParam, controller.updateRole);
router.delete('/:id', validateIdParam, controller.remove);

module.exports = router;
