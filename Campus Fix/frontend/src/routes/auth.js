const { Router } = require('express');
const { ApiError } = require('../lib/api');
const { safeNext, firstName } = require('../lib/helpers');

const router = Router();

const home = (user) => (user.role === 'admin' ? '/admin' : '/dashboard');

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(home(req.user));
  res.render('login', { title: 'Log in', values: {}, error: null, next: safeNext(req.query.next) || '' });
});

router.post('/login', async (req, res) => {
  const { email = '', password = '', next } = req.body;
  try {
    const { user, token } = await req.api('POST', '/auth/login', { email, password });
    res.setToken(token);
    res.flash('success', `Welcome back, ${firstName(user.name)}.`);
    res.redirect(safeNext(next) || home(user));
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500) throw err;
    res.status(err.status).render('login', {
      title: 'Log in',
      values: { email },
      error: err.status === 401 ? 'That email and password do not match an account.' : err.readable,
      next: safeNext(next) || '',
    });
  }
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect(home(req.user));
  res.render('register', { title: 'Create account', values: { role: 'student' }, errors: {}, error: null });
});

router.post('/register', async (req, res) => {
  const { name = '', email = '', password = '', confirmPassword = '', role = 'student' } = req.body;
  const render = (status, error, errors = {}) =>
    res.status(status).render('register', { title: 'Create account', values: { name, email, role }, error, errors });

  if (password !== confirmPassword) return render(400, null, { confirmPassword: 'Passwords do not match.' });

  try {
    const { user, token } = await req.api('POST', '/auth/register', { name, email, password, role });
    res.setToken(token);
    res.flash('success', `Your account is ready, ${firstName(user.name)}. Report your first problem below.`);
    res.redirect('/requests/new');
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500) throw err;
    const errors = err.fieldErrors;
    if (err.status === 409) errors.email = 'An account with this email already exists. Log in instead.';
    render(err.status, Object.keys(errors).length ? null : err.readable, errors);
  }
});

router.post('/logout', (req, res) => {
  res.clearToken();
  res.flash('success', 'You have logged out.');
  res.redirect('/');
});

module.exports = router;
