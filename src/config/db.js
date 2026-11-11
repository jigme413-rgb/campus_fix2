const { Pool } = require('pg');
require('dotenv').config();

// One shared connection pool for the whole application.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Certificates are verified when SSL is on. On Render use the Internal Database URL (no SSL needed).
  ssl: process.env.DB_SSL === 'true',
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

module.exports = {
  // Every query in the app goes through here with $1, $2... placeholders (parameterised SQL).
  query: (text, params) => pool.query(text, params),
  pool,
};
