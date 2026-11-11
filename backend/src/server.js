const app = require('./app');
const db = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`CampusFix API running at http://localhost:${PORT}/api`);
});

// Close the HTTP server and database pool cleanly (Render sends SIGTERM on redeploy)
function shutdown() {
  server.close(() => db.pool.end().then(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
