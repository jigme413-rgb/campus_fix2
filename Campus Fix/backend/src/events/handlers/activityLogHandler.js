// Logs every event ("log creation", "log assignment" in the proposal) to the
// console and keeps the most recent ones in memory for GET /api/events.
const { EVENTS } = require('../eventBus');

const MAX_ENTRIES = 50;
const recent = [];

function record(eventName, { request, actor, staff, previousStatus, newStatus }) {
  const entry = {
    event: eventName,
    request_id: request ? request.id : null,
    title: request ? request.title : null,
    actor: actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
    details: {
      ...(staff && { assigned_to: staff.name }),
      ...(previousStatus !== undefined && { from: previousStatus }),
      ...(newStatus && { to: newStatus }),
    },
    at: new Date().toISOString(),
  };
  recent.unshift(entry);
  if (recent.length > MAX_ENTRIES) recent.pop();

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[event] ${eventName} request=#${entry.request_id} by=${entry.actor ? entry.actor.name : 'system'}`);
  }
  return entry;
}

function register(bus) {
  Object.values(EVENTS).forEach((eventName) => {
    bus.on(eventName, (payload) => record(eventName, payload));
  });
}

const getRecent = () => [...recent];
const clear = () => { recent.length = 0; };

module.exports = { register, record, getRecent, clear };
