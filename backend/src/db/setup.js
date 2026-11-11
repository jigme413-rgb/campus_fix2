/*
 * Creates the database (if missing), applies db/schema.sql and seeds data.
 *
 *   npm run db:setup                  -> uses .env, keeps existing data, adds demo data to an empty DB
 *   npm run db:reset                  -> drops all CampusFix tables first, then rebuilds with demo data
 *   node src/db/setup.js --no-demo    -> only categories + admin account
 *   npm run db:setup:test             -> uses .env.test, always resets, no demo data
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const isTest = process.argv.includes('--test');
require('dotenv').config({ path: path.join(__dirname, '..', '..', isTest ? '.env.test' : '.env') });

const { seed } = require('./seed');

const sslOption = () => process.env.DB_SSL === 'true';

async function ensureDatabase(connectionString) {
  const target = new URL(connectionString);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  const maintenanceUrl = new URL(connectionString);
  maintenanceUrl.pathname = '/postgres';

  const client = new Client({ connectionString: maintenanceUrl.toString(), ssl: sslOption() });
  try {
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      // Identifiers cannot be parameterised, so quote the name safely.
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}"`);
    }
  } catch (err) {
    // Managed hosts (Render) create the database for you and may not allow this check.
    console.warn(`Skipping database creation check: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function setupDatabase({ reset = false, demo = true, quiet = false } = {}) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  await ensureDatabase(process.env.DATABASE_URL);

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslOption() });
  await client.connect();
  try {
    if (reset) {
      await client.query('DROP TABLE IF EXISTS notifications, status_history, requests, categories, users CASCADE');
    }
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await seed(client, { demo });
    if (!quiet) console.log(`Database ready${reset ? ' (reset)' : ''}${demo ? ' with demo data' : ''}.`);
  } finally {
    await client.end();
  }
}

module.exports = { setupDatabase };

if (require.main === module) {
  const reset = isTest || process.argv.includes('--reset');
  const demo = !isTest && !process.argv.includes('--no-demo');
  setupDatabase({ reset, demo }).catch((err) => {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  });
}
