const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helpers = require('./lib/helpers');
const { ApiError } = require('./lib/api');
const { flash, attachApi, loadUser } = require('./middleware/session');

const app = express();
const root = path.join(__dirname, '..');

app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.set('trust proxy', 1);
Object.assign(app.locals, helpers);
// Changes on every restart/deploy so browsers fetch fresh CSS/JS despite caching
app.locals.assetVersion = Date.now().toString(36);

app.use(express.static(path.join(root, 'public'), { maxAge: '1h' }));
// Self-hosted display face (variable, latin subset only is downloaded thanks to unicode-range)
app.use('/vendor/outfit', express.static(path.join(root, 'node_modules/@fontsource-variable/outfit'), { maxAge: '30d' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Basic security headers (no inline scripts are used, so a strict CSP is possible)
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

// Light/dark theme from the header toggle. No cookie = follow the device setting.
app.use((req, res, next) => {
  const t = req.cookies.theme;
  res.locals.theme = t === 'light' || t === 'dark' ? t : null;
  res.locals.currentUrl = req.method === 'GET' ? req.originalUrl : '/';
  next();
});
app.post('/theme', (req, res) => {
  const theme = req.body.theme === 'dark' ? 'dark' : 'light';
  res.cookie('theme', theme, { sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000 });
  res.redirect(helpers.safeNext(req.body.returnTo) || '/');
});

app.use(flash);
app.use(attachApi);
app.use(loadUser);

app.use(require('./routes/home'));
app.use(require('./routes/auth'));
app.use('/requests', require('./routes/requests'));
app.use('/notifications', require('./routes/notifications'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', status: 404, message: 'There is no page at this address.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ApiError && err.status === 401) {
    res.clearToken();
    res.flash('info', 'Your session has ended. Log in again to continue.');
    return res.redirect(req.method === 'GET' ? `/login?next=${encodeURIComponent(req.originalUrl)}` : '/login');
  }

  const status = err.status || 500;
  if (!(err instanceof ApiError)) console.error(err);
  res.status(status).render('error', {
    title: status === 404 ? 'Not found' : status === 403 ? 'Not allowed' : 'Something went wrong',
    status,
    message:
      err instanceof ApiError
        ? err.readable
        : 'An unexpected error occurred. Try again in a moment.',
  });
});

module.exports = app;
