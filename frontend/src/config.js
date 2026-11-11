require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  apiUrl: (process.env.API_URL || 'http://localhost:3000/api').replace(/\/$/, ''),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  // Matches the API's default token lifetime (JWT_EXPIRES_IN=1d)
  tokenMaxAgeMs: 24 * 60 * 60 * 1000,
};
