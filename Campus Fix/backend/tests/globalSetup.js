// Runs once before the whole Jest suite: rebuilds the TEST database from schema.sql.
const path = require('path');

module.exports = async () => {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });
  process.env.NODE_ENV = 'test';
  if (!/test/i.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to reset a database whose name does not contain "test". Check .env.test');
  }
  const { setupDatabase } = require('../src/db/setup');
  await setupDatabase({ reset: true, demo: false, quiet: true });
};
