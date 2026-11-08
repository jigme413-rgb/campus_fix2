// Pure validation helpers. Each validator returns { valid, errors, value }:
//   errors - [{ field, message }] so clients can show messages next to inputs
//   value  - the cleaned input that controllers should save

const ROLES = ['student', 'staff', 'maintenance', 'admin'];
const REPORTER_ROLES = ['student', 'staff'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Pending', 'Assigned', 'In Progress', 'Completed'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const result = (errors, value) => ({ valid: errors.length === 0, errors, value });

function isPositiveInt(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return false;
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

function isValidEmail(email) {
  return EMAIL_RE.test(str(email));
}

// At least 8 characters with at least one letter and one number
function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function validateRegistration(body = {}, { allowedRoles = REPORTER_ROLES } = {}) {
  const errors = [];
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const role = body.role === undefined || body.role === '' ? 'student' : str(body.role);

  if (name.length < 2 || name.length > 100) errors.push({ field: 'name', message: 'Name must be 2-100 characters' });
  if (!isValidEmail(email)) errors.push({ field: 'email', message: 'Enter a valid email address' });
  if (!isStrongPassword(body.password)) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters with a letter and a number' });
  }
  if (!allowedRoles.includes(role)) {
    errors.push({ field: 'role', message: `Role must be one of: ${allowedRoles.join(', ')}` });
  }

  return result(errors, { name, email, password: body.password, role });
}

function validateLogin(body = {}) {
  const errors = [];
  const email = str(body.email).toLowerCase();
  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  if (!body.password) errors.push({ field: 'password', message: 'Password is required' });
  return result(errors, { email, password: body.password });
}

/**
 * Validates a maintenance request (FR2).
 * partial = true (used by PUT) only checks the fields that were sent.
 */
function validateRequest(body = {}, { partial = false } = {}) {
  const errors = [];
  const value = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('title')) {
    const title = str(body.title);
    if (title.length < 3 || title.length > 150) {
      errors.push({ field: 'title', message: 'Title is required (3-150 characters)' });
    }
    value.title = title;
  }
  if (!partial || has('description')) {
    const description = str(body.description);
    if (description.length < 5 || description.length > 2000) {
      errors.push({ field: 'description', message: 'Description is required (5-2000 characters)' });
    }
    value.description = description;
  }
  if (!partial || has('location')) {
    const location = str(body.location);
    if (location.length < 2 || location.length > 150) {
      errors.push({ field: 'location', message: 'Location is required (2-150 characters)' });
    }
    value.location = location;
  }
  if (!partial || has('category_id')) {
    if (!isPositiveInt(body.category_id)) errors.push({ field: 'category_id', message: 'Choose a category' });
    value.category_id = Number(body.category_id);
  }
  if (has('priority') && body.priority !== '') {
    if (!PRIORITIES.includes(body.priority)) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${PRIORITIES.join(', ')}` });
    }
    value.priority = body.priority;
  } else if (!partial) {
    value.priority = 'Medium';
  }

  if (partial && Object.keys(value).length === 0) errors.push({ field: 'body', message: 'Nothing to update' });
  return result(errors, value);
}

function validateStatus(body = {}) {
  const errors = [];
  if (!STATUSES.includes(body.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${STATUSES.join(', ')}` });
  }
  const note = str(body.note);
  if (note.length > 500) errors.push({ field: 'note', message: 'Note must be 500 characters or fewer' });
  return result(errors, { status: body.status, note: note || null });
}

function validateCategory(body = {}) {
  const name = str(body.name);
  const errors = name.length < 2 || name.length > 50 ? [{ field: 'name', message: 'Category name must be 2-50 characters' }] : [];
  return result(errors, { name });
}

/**
 * Workflow rules for FR6.
 * Maintenance staff move their work forward one step: Assigned -> In Progress -> Completed.
 * Admins may move a request to any other status (e.g. reopen a Completed request).
 */
function canTransition(role, from, to) {
  if (from === to || !STATUSES.includes(to)) return false;
  if (role === 'admin') return true;
  if (role === 'maintenance') {
    return (from === 'Assigned' && to === 'In Progress') || (from === 'In Progress' && to === 'Completed');
  }
  return false;
}

module.exports = {
  ROLES,
  REPORTER_ROLES,
  PRIORITIES,
  STATUSES,
  isPositiveInt,
  isValidEmail,
  isStrongPassword,
  validateRegistration,
  validateLogin,
  validateRequest,
  validateStatus,
  validateCategory,
  canTransition,
};
