const Request = require('../models/requestModel');
const activityLog = require('../events/handlers/activityLogHandler');

// GET /api/stats (admin) - workload, recurring issues and response times
async function overview(req, res) {
  res.json({ stats: await Request.stats() });
}

// GET /api/events (admin) - the most recent events raised in this server process
async function recentEvents(req, res) {
  res.json({ events: activityLog.getRecent() });
}

module.exports = { overview, recentEvents };
