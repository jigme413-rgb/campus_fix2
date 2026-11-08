// Event handlers that create in-app notifications.
const { EVENTS } = require('../eventBus');
const Notification = require('../../models/notificationModel');
const User = require('../../models/userModel');

const label = (request) => `#${request.id} "${request.title}"`;

// maintenanceRequestCreated -> notify every administrator
async function onRequestCreated({ request }) {
  const adminIds = await User.findIdsByRole('admin');
  await Notification.createForUsers(adminIds, {
    request_id: request.id,
    type: EVENTS.REQUEST_CREATED,
    message: `New ${request.priority.toLowerCase()} priority request ${label(request)} at ${request.location}.`,
  });
}

// requestAssigned -> notify the assigned staff member (and tell the reporter)
async function onRequestAssigned({ request, staff }) {
  await Notification.create({
    user_id: staff.id,
    request_id: request.id,
    type: EVENTS.REQUEST_ASSIGNED,
    message: `You have been assigned request ${label(request)} at ${request.location}.`,
  });
  await Notification.create({
    user_id: request.reporter_id,
    request_id: request.id,
    type: EVENTS.REQUEST_ASSIGNED,
    message: `Your request ${label(request)} has been assigned to ${staff.name}.`,
  });
}

// requestStatusUpdated -> let the reporter know work has started
async function onStatusUpdated({ request, newStatus }) {
  if (newStatus !== 'In Progress') return; // Assigned and Completed have their own events
  await Notification.create({
    user_id: request.reporter_id,
    request_id: request.id,
    type: EVENTS.REQUEST_STATUS_UPDATED,
    message: `Work has started on your request ${label(request)}.`,
  });
}

// requestCompleted -> notify the reporter that the problem is resolved
async function onRequestCompleted({ request }) {
  await Notification.create({
    user_id: request.reporter_id,
    request_id: request.id,
    type: EVENTS.REQUEST_COMPLETED,
    message: `Good news! Your request ${label(request)} has been resolved.`,
  });
}

function register(bus) {
  bus.on(EVENTS.REQUEST_CREATED, onRequestCreated);
  bus.on(EVENTS.REQUEST_ASSIGNED, onRequestAssigned);
  bus.on(EVENTS.REQUEST_STATUS_UPDATED, onStatusUpdated);
  bus.on(EVENTS.REQUEST_COMPLETED, onRequestCompleted);
}

module.exports = { register, onRequestCreated, onRequestAssigned, onStatusUpdated, onRequestCompleted };
