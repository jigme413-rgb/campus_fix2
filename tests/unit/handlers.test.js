// Event handlers tested in isolation: the models are mocked, so no database is used.
jest.mock('../../src/models/statusHistoryModel');
jest.mock('../../src/models/notificationModel');
jest.mock('../../src/models/userModel');

const StatusHistory = require('../../src/models/statusHistoryModel');
const Notification = require('../../src/models/notificationModel');
const User = require('../../src/models/userModel');
const { CampusFixEventBus, EVENTS } = require('../../src/events/eventBus');
const historyHandler = require('../../src/events/handlers/historyHandler');
const notificationHandler = require('../../src/events/handlers/notificationHandler');
const activityLog = require('../../src/events/handlers/activityLogHandler');

const request = { id: 9, title: 'Leaking tap', location: 'Hostel 2', priority: 'High', status: 'Pending', reporter_id: 5 };
const admin = { id: 1, name: 'Admin', role: 'admin' };
const staff = { id: 7, name: 'Karma Wangdi', role: 'maintenance' };

let bus;
beforeEach(() => {
  jest.clearAllMocks();
  activityLog.clear();
  bus = new CampusFixEventBus();
  historyHandler.register(bus);
  notificationHandler.register(bus);
  activityLog.register(bus);
});

describe('history handler', () => {
  it('T8: requestStatusUpdated writes a status_history row', async () => {
    await bus.emitAsync(EVENTS.REQUEST_STATUS_UPDATED, {
      request, previousStatus: 'Assigned', newStatus: 'In Progress', actor: staff, note: 'On my way',
    });
    expect(StatusHistory.create).toHaveBeenCalledWith({
      request_id: 9, old_status: 'Assigned', new_status: 'In Progress', changed_by: 7, note: 'On my way',
    });
  });

  it('maintenanceRequestCreated writes the first (none -> Pending) row', async () => {
    User.findIdsByRole.mockResolvedValue([1]);
    await bus.emitAsync(EVENTS.REQUEST_CREATED, { request, actor: { id: 5 } });
    expect(StatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: 9, old_status: null, new_status: 'Pending', changed_by: 5 })
    );
  });

  it('requestAssigned records the move to Assigned with the staff name', async () => {
    await bus.emitAsync(EVENTS.REQUEST_ASSIGNED, { request, staff, actor: admin, previousStatus: 'Pending' });
    expect(StatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ old_status: 'Pending', new_status: 'Assigned', note: 'Assigned to Karma Wangdi' })
    );
  });
});

describe('notification handler', () => {
  it('notifies every administrator when a request is created', async () => {
    User.findIdsByRole.mockResolvedValue([1, 2]);
    await bus.emitAsync(EVENTS.REQUEST_CREATED, { request, actor: { id: 5 } });
    expect(User.findIdsByRole).toHaveBeenCalledWith('admin');
    expect(Notification.createForUsers).toHaveBeenCalledWith(
      [1, 2],
      expect.objectContaining({ request_id: 9, type: 'maintenanceRequestCreated' })
    );
  });

  it('notifies the assigned staff member and the reporter on assignment', async () => {
    await bus.emitAsync(EVENTS.REQUEST_ASSIGNED, { request, staff, actor: admin, previousStatus: 'Pending' });
    const recipients = Notification.create.mock.calls.map(([n]) => n.user_id);
    expect(recipients).toEqual([7, 5]);
  });

  it('notifies the reporter when the request is completed', async () => {
    await bus.emitAsync(EVENTS.REQUEST_COMPLETED, { request, actor: staff });
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 5, type: 'requestCompleted', message: expect.stringMatching(/resolved/) })
    );
  });

  it('does not notify on status updates other than In Progress', async () => {
    await bus.emitAsync(EVENTS.REQUEST_STATUS_UPDATED, { request, previousStatus: 'In Progress', newStatus: 'Completed', actor: staff });
    expect(Notification.create).not.toHaveBeenCalled();
  });
});

describe('activity log handler', () => {
  it('keeps the most recent events, newest first', async () => {
    User.findIdsByRole.mockResolvedValue([]);
    await bus.emitAsync(EVENTS.REQUEST_CREATED, { request, actor: admin });
    await bus.emitAsync(EVENTS.REQUEST_COMPLETED, { request, actor: staff });
    const events = activityLog.getRecent();
    expect(events.map((e) => e.event)).toEqual(['requestCompleted', 'maintenanceRequestCreated']);
    expect(events[0]).toMatchObject({ request_id: 9, actor: { name: 'Karma Wangdi' } });
  });
});
