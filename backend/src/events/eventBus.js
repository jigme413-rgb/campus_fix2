const { EventEmitter } = require('events');

// The four core events from the proposal (section 8)
const EVENTS = Object.freeze({
  REQUEST_CREATED: 'maintenanceRequestCreated',
  REQUEST_ASSIGNED: 'requestAssigned',
  REQUEST_STATUS_UPDATED: 'requestStatusUpdated',
  REQUEST_COMPLETED: 'requestCompleted',
});

/**
 * Node's EventEmitter with one addition: emitAsync().
 *
 * A plain emit() calls each listener but does not wait for async listeners,
 * and an error thrown by one listener would crash the request. emitAsync()
 * runs every listener, waits for all of them, and logs (instead of throwing)
 * any handler that fails, so a broken notification can never undo a saved request.
 */
class CampusFixEventBus extends EventEmitter {
  async emitAsync(eventName, payload) {
    const listeners = this.listeners(eventName);
    const results = await Promise.allSettled(
      listeners.map((listener) => Promise.resolve().then(() => listener(payload)))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[event] handler #${i + 1} for "${eventName}" failed: ${r.reason && r.reason.message}`);
      }
    });
    return results;
  }
}

// The application-wide bus (a singleton because Node caches required modules)
const eventBus = new CampusFixEventBus();
eventBus.setMaxListeners(20);

module.exports = { eventBus, EVENTS, CampusFixEventBus };
