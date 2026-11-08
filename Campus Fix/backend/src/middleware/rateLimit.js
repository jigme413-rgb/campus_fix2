const rateLimit = require('express-rate-limit');

// Slows down password guessing: 10 login attempts per IP per 15 minutes.
// Disabled under Jest so the test suite can log in as often as it needs.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) =>
    res.status(429).json({ error: { message: 'Too many login attempts. Try again in 15 minutes.' } }),
});

module.exports = { loginLimiter };
