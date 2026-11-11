// Load the test database settings before any module reads process.env.
// Variables already set in the environment (e.g. by GitHub Actions) take priority.
require('dotenv').config({ path: '.env.test' });
