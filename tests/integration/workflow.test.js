// The full event flow from proposal section 8.1, end to end through the API:
// submit -> assign -> In Progress -> Completed, checking history and notifications.
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { createUser, anyCategoryId, validRequest } = require('../helpers');

let student, admin, staff, otherStaff, requestId;

beforeAll(async () => {
  [student, admin, staff, otherStaff] = await Promise.all([
    createUser('student', 'Workflow Student'),
    createUser('admin', 'Workflow Admin'),
    createUser('maintenance', 'Workflow Electrician'),
    createUser('maintenance', 'Someone Else'),
  ]);
  const res = await request(app)
    .post('/api/requests')
    .set(student.auth)
    .send(validRequest(await anyCategoryId(), { title: 'Broken light in Lecture Hall 3' }));
  requestId = res.body.request.id;
});

afterAll(() => db.pool.end());

const notificationsFor = async (who) => (await request(app).get('/api/notifications').set(who.auth)).body;

it('step 1: creation notifies administrators and starts the history', async () => {
  const { notifications } = await notificationsFor(admin);
  expect(notifications.some((n) => n.request_id === requestId && n.type === 'maintenanceRequestCreated')).toBe(true);

  const { rows } = await db.query('SELECT * FROM status_history WHERE request_id = $1', [requestId]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ old_status: null, new_status: 'Pending' });
});

it('maintenance cannot change status before the request is assigned to them', async () => {
  const res = await request(app)
    .patch(`/api/requests/${requestId}/status`)
    .set(staff.auth)
    .send({ status: 'In Progress' });
  expect(res.status).toBe(403);
});

it('step 2: assignment notifies the staff member', async () => {
  await request(app).patch(`/api/requests/${requestId}/assign`).set(admin.auth).send({ staff_id: staff.user.id }).expect(200);
  const { notifications, unread } = await notificationsFor(staff);
  expect(unread).toBeGreaterThan(0);
  expect(notifications[0]).toMatchObject({ request_id: requestId, type: 'requestAssigned' });
});

it('other maintenance staff cannot update a request that is not theirs', async () => {
  const res = await request(app)
    .patch(`/api/requests/${requestId}/status`)
    .set(otherStaff.auth)
    .send({ status: 'In Progress' });
  expect(res.status).toBe(403);
});

it('staff cannot skip straight from Assigned to Completed', async () => {
  const res = await request(app)
    .patch(`/api/requests/${requestId}/status`)
    .set(staff.auth)
    .send({ status: 'Completed' });
  expect(res.status).toBe(400);
});

it('step 3: staff start work (In Progress)', async () => {
  const res = await request(app)
    .patch(`/api/requests/${requestId}/status`)
    .set(staff.auth)
    .send({ status: 'In Progress', note: 'Replacing the starter' });
  expect(res.status).toBe(200);
  expect(res.body.request.status).toBe('In Progress');
});

it('T6: staff mark the request Completed and the reporter is notified', async () => {
  const res = await request(app)
    .patch(`/api/requests/${requestId}/status`)
    .set(staff.auth)
    .send({ status: 'Completed' });
  expect(res.status).toBe(200);
  expect(res.body.request.status).toBe('Completed');
  expect(res.body.request.completed_at).not.toBeNull();

  const { notifications } = await notificationsFor(student);
  expect(notifications[0]).toMatchObject({ request_id: requestId, type: 'requestCompleted' });
});

it('T8 (integration): every status change is in status_history, in order', async () => {
  const res = await request(app).get(`/api/requests/${requestId}`).set(student.auth);
  expect(res.status).toBe(200);
  expect(res.body.history.map((h) => [h.old_status, h.new_status])).toEqual([
    [null, 'Pending'],
    ['Pending', 'Assigned'],
    ['Assigned', 'In Progress'],
    ['In Progress', 'Completed'],
  ]);
  expect(res.body.history[2]).toMatchObject({ note: 'Replacing the starter', changed_by_name: 'Workflow Electrician' });
});

it('the student can mark notifications as read', async () => {
  const before = await notificationsFor(student);
  const first = before.notifications[0];
  await request(app).patch(`/api/notifications/${first.id}/read`).set(student.auth).expect(200);
  await request(app).patch('/api/notifications/read-all').set(student.auth).expect(200);
  expect((await notificationsFor(student)).unread).toBe(0);
});

it("users cannot mark someone else's notification as read", async () => {
  const { notifications } = await notificationsFor(staff);
  const res = await request(app).patch(`/api/notifications/${notifications[0].id}/read`).set(student.auth);
  expect(res.status).toBe(404);
});

it('an admin can reopen a completed request back to Pending, which releases the assignment', async () => {
  const res = await request(app)
    .patch(`/api/requests/${requestId}/status`)
    .set(admin.auth)
    .send({ status: 'Pending', note: 'Light failed again' });
  expect(res.status).toBe(200);
  expect(res.body.request).toMatchObject({ status: 'Pending', assigned_to: null, completed_at: null });
});
