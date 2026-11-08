const { apiUrl } = require('../config');

/** An error returned by the CampusFix API (or raised when it cannot be reached). */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
  }

  /** One readable sentence including any field-level validation messages. */
  get readable() {
    if (!this.details.length) return this.message;
    return this.details.map((d) => d.message).join('. ') + '.';
  }

  /** { field: message } for showing errors next to form inputs. */
  get fieldErrors() {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

/**
 * Calls the API from the server. The JWT lives in an httpOnly cookie and is
 * attached here, so browser JavaScript never sees it.
 * clientIp is forwarded so the API's login rate limit counts each user separately.
 */
async function api(token, method, path, body, clientIp) {
  let res;
  try {
    res = await fetch(apiUrl + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(clientIp && { 'X-Forwarded-For': clientIp }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(503, 'The CampusFix API is not reachable. Start it with "npm run dev" in the backend folder.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message || `Request failed (${res.status})`, data?.error?.details);
  }
  return data;
}

module.exports = { api, ApiError };
