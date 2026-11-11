const { Router } = require('express');
const controller = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');
const { validateRegistration, validateLogin } = require('../utils/validators');

const router = Router();

router.post('/register', validateBody(validateRegistration), controller.register);
router.post('/login', loginLimiter, validateBody(validateLogin), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
