const { HttpError } = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Every error ends here and leaves as:
 *   { "error": { "message": "...", "details": [{ "field": "...", "message": "..." }] } }
 * Express identifies error handlers by their four arguments, so `next` must stay.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  let details = err.details;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else if (err.code === '23505') {
    status = 409; // PostgreSQL unique_violation
    message = err.constraint === 'users_email_key' ? 'Email is already registered' : 'That value already exists';
  } else if (err.code === '23503') {
    status = 400; // foreign_key_violation
    message = 'A referenced record does not exist';
  } else if (err.code === '22P02' || err.code === '22003') {
    status = 400; // invalid_text_representation / numeric out of range
    message = 'Invalid value in request';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Internal server error';
    details = undefined;
  }

  res.status(status).json({ error: { message, ...(details && { details }) } });
}

module.exports = { notFound, errorHandler };
