// Event handlers that write the status_history log (FR7).
const { EVENTS } = require('../eventBus');
const StatusHistory = require('../../models/statusHistoryModel');

// maintenanceRequestCreated -> first history row: (none) -> Pending
async function onRequestCreated({ request, actor }) {
  await StatusHistory.create({
    request_id: request.id,
    old_status: null,
    new_status: request.status,
    changed_by: actor ? actor.id : request.reporter_id,
    note: 'Request submitted',
  });
}

// requestAssigned -> status becomes Assigned
async function onRequestAssigned({ request, staff, actor, previousStatus }) {
  await StatusHistory.create({
    request_id: request.id,
    old_status: previousStatus,
    new_status: 'Assigned',
    changed_by: actor ? actor.id : null,
    note: `Assigned to ${staff.name}`,
  });
}

// requestStatusUpdated -> record old and new status
async function onStatusUpdated({ request, previousStatus, newStatus, actor, note }) {
  await StatusHistory.create({
    request_id: request.id,
    old_status: previousStatus,
    new_status: newStatus,
    changed_by: actor ? actor.id : null,
    note: note || null,
  });
}

function register(bus) {
  bus.on(EVENTS.REQUEST_CREATED, onRequestCreated);
  bus.on(EVENTS.REQUEST_ASSIGNED, onRequestAssigned);
  bus.on(EVENTS.REQUEST_STATUS_UPDATED, onStatusUpdated);
}

module.exports = { register, onRequestCreated, onRequestAssigned, onStatusUpdated };
