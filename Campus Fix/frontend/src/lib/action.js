const { ApiError } = require('./api');

/**
 * Wraps a form-POST handler. If the API rejects the action with a client error
 * (400/403/404/409), show the message as a flash and redirect back instead of
 * rendering an error page. 401 and server errors go to the error handler.
 *
 * `fallback` is a redirect target or a function (req) => target.
 */
function action(fallback, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401 && err.status < 500) {
        res.flash('error', err.readable);
        return res.redirect(typeof fallback === 'function' ? fallback(req) : fallback);
      }
      throw err;
    }
  };
}

module.exports = action;
