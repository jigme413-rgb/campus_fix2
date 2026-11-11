// Wires every handler module to the application event bus.
// To add new behaviour, create a handler in ./handlers and register it here;
// no controller needs to change.
const { eventBus, EVENTS } = require('./eventBus');
const historyHandler = require('./handlers/historyHandler');
const notificationHandler = require('./handlers/notificationHandler');
const activityLogHandler = require('./handlers/activityLogHandler');

let registered = false;

function registerEventHandlers(bus = eventBus) {
  if (bus === eventBus && registered) return bus; // avoid double registration
  historyHandler.register(bus);
  notificationHandler.register(bus);
  activityLogHandler.register(bus);
  if (bus === eventBus) registered = true;
  return bus;
}

module.exports = { registerEventHandlers, eventBus, EVENTS };
