module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  // Rebuilds the test database once before the whole suite
  globalSetup: './tests/globalSetup.js',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/db/**'],
  coverageReporters: ['text-summary', 'lcov'],
};
