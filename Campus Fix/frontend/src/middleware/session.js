const { api, ApiError } = require('../lib/api');
const { safeNext } = require('../lib/helpers');
const { cookieSecure, tokenMaxAgeMs } = require('../config');

// httpOnly: page scripts cannot read the token. SameSite=Lax: other sites cannot POST forms with it.
const COOKIE_BASE = { httpOnly: true, sameSite: 'lax', secure: cookieSecure };

/** One-shot messages that survive a redirect ("Request submitted"). */
function flash(req, res, next) {
  res.locals.flash = null;
  if (req.cookies.flash) {
    try {
      res.locals.flash = JSON.parse(req.cookies.flash);
    } catch {
      /* ignore a malformed cookie */
    }
    res.clearCookie('flash', COOKIE_BASE);
  }
  res.flash = (type, message) =>
    res.cookie('flash', JSON.stringify({ type, message }), { ...COOKIE_BASE, maxAge: 60_000 });
  next();
}

/** Adds req.api(method, path, body), which sends the logged-in user's token. */
function attachApi(req, res, next) {
  req.api = (method, path, body) => api(req.cookies.token, method, path, body, req.ip);
  res.setToken = (token) => res.cookie('token', token, { ...COOKIE_BASE, maxAge: tokenMaxAgeMs });
  res.clearToken = () => res.clearCookie('token', COOKIE_BASE);
  next();
}

/** Loads the current user and their unread notification count for the header. */
async function loadUser(req, res, next) {
  res.locals.user = null;
  res.locals.unread = 0;
  res.locals.currentPath = req.path;

  if (!req.cookies.token) return next();
  try {
    const [me, notes] = await Promise.all([
      req.api('GET', '/auth/me'),
      req.api('GET', '/notifications?unread=true'),
    ]);
    req.user = me.user;
    res.locals.user = me.user;
    res.locals.unread = notes.unread;
  } catch (err) {
    // Expired or invalid token: continue as a guest
    if (err instanceof ApiError && err.status === 401) res.clearToken();
    else throw err;
  }
  next();
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  const target = req.method === 'GET' ? req.originalUrl : null;
  res.flash('info', 'Log in to continue.');
  res.redirect('/login' + (target ? `?next=${encodeURIComponent(safeNext(target) || '/')}` : ''));
}

/** requireRole('admin') or requireRole('maintenance', 'admin') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return requireLogin(req, res, next);
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', {
        title: 'Not allowed',
        status: 403,
        message: 'Your account does not have access to this page.',
      });
    }
    next();
  };
}

module.exports = { flash, attachApi, loadUser, requireLogin, requireRole };
