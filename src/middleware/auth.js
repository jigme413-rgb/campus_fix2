const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { unauthorized, forbidden } = require('../utils/httpError');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

/**
 * Requires "Authorization: Bearer <token>".
 * The user is re-loaded from the database so a deleted account or changed
 * role takes effect immediately, not when the token expires.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Missing or malformed Authorization header');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  req.user = user;
  next();
}

// Usage: authorize('admin') or authorize('maintenance', 'admin')
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden(`This action requires role: ${roles.join(' or ')}`));
    next();
  };
}

module.exports = { signToken, authenticate, authorize };
