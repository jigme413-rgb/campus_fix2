const { badRequest, notFound } = require('../utils/httpError');
const { isPositiveInt } = require('../utils/validators');

/** Runs a validator from utils/validators and replaces req.body with the cleaned value. */
function validateBody(validator, options) {
  return (req, res, next) => {
    const { valid, errors, value } = validator(req.body || {}, options);
    if (!valid) return next(badRequest('Validation failed', errors));
    req.body = value;
    next();
  };
}

/** :id must be a positive integer; anything else cannot exist, so 404. */
function validateIdParam(req, res, next) {
  if (!isPositiveInt(req.params.id)) return next(notFound('Resource not found'));
  req.params.id = Number(req.params.id);
  next();
}

module.exports = { validateBody, validateIdParam };
