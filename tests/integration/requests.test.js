// The sample test cases T1-T7 from the proposal (section 11.2), plus access-control edge cases.
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { eventBus, EVENTS } = require('../../src/events/eventBus');
const { createUser, anyCategoryId, validRequest } = require('../helpers');

let student, otherStudent, admin, staff, otherStaff, categoryId;

beforeAll(async () => {
  [student, otherStudent, admin, staff, otherStaff] = await Promise.all([
    createUser('student', 'Tashi Student'),
    createUser('student', 'Other Student'),
    createUser('admin', 'Test Admin'),
    createUser('maintenance', 'Karma Electrician'),
    createUser('maintenance', 'Other Maintenance'),
  ]);
  categoryId = await anyCategoryId();
});

afterAll(() => db.pool.end());

const submit = (overrides) =>
  request(app).post('/api/requests').set(student.auth).send(validRequest(categoryId, overrides));

describe('T1: submit a valid request', () => {
  it('returns 201 and emits maintenanceRequestCreated', async () => {
    const listener = jest.fn();
    eventBus.on(EVENTS.REQUEST_CREATED, listener);

    const res = await submit();

    eventBus.off(EVENTS.REQUEST_CREATED, listener);
    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({
      title: 'Broken classroom light',
      status: 'Pending',
      priority: 'High',
      reporter_id: student.user.id,
      reporter_name: 'Tashi Student',
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ id: res.body.request.id }) })
    );
  });
});

describe('T2: submit a request with a missing title', () => {
  it('returns 400 with an error message for the title field', async () => {
    const res = await submit({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'title' })])
    );
  });

  it('returns 400 when the category does not exist', async () => {
    const res = await submit({ category_id: 99999 });
    expect(res.status).toBe(400);
  });
});

describe('T3: access requests without a token', () => {
  it('returns 401', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(401);
  });
});

describe('T4: a student tries to assign a request', () => {
  it('returns 403 Forbidden', async () => {
    const { body } = await submit();
    const res = await request(app)
      .patch(`/api/requests/${body.request.id}/assign`)
      .set(student.auth)
      .send({ staff_id: staff.user.id });
    expect(res.status).toBe(403);
  });
});

describe('T5: admin assigns a request to staff', () => {
  it('sets status to Assigned and emits requestAssigned', async () => {
    const { body } = await submit();
    const listener = jest.fn();
    eventBus.on(EVENTS.REQUEST_ASSIGNED, listener);

    const res = await request(app)
      .patch(`/api/requests/${body.request.id}/assign`)
      .set(admin.auth)
      .send({ staff_id: staff.user.id });

    eventBus.off(EVENTS.REQUEST_ASSIGNED, listener);
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ status: 'Assigned', assigned_to: staff.user.id, assigned_name: 'Karma Electrician' });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ staff: expect.objectContaining({ id: staff.user.id }) }));
  });

  it('rejects assigning to a user who is not maintenance staff', async () => {
    const { body } = await submit();
    const res = await request(app)
      .patch(`/api/requests/${body.request.id}/assign`)
      .set(admin.auth)
      .send({ staff_id: otherStudent.user.id });
    expect(res.status).toBe(400);
  });
});

describe('T7: view a request with an unknown ID', () => {
  it('returns 404 for an id that does not exist', async () => {
    const res = await request(app).get('/api/requests/999999').set(admin.auth);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-numeric id', async () => {
    const res = await request(app).get('/api/requests/abc').set(admin.auth);
    expect(res.status).toBe(404);
  });
});

describe('role-based visibility (FR3, FR4)', () => {
  let mine;
  beforeAll(async () => {
    mine = (await submit({ title: 'Visibility check request', location: 'Library' })).body.request;
  });

  it('a student only lists their own requests', async () => {
    const res = await request(app).get('/api/requests').set(otherStudent.auth);
    expect(res.status).toBe(200);
    expect(res.body.requests.every((r) => r.reporter_id === otherStudent.user.id)).toBe(true);
  });

  it("a student cannot open someone else's request", async () => {
    const res = await request(app).get(`/api/requests/${mine.id}`).set(otherStudent.auth);
    expect(res.status).toBe(403);
  });

  it('maintenance staff only see requests assigned to them', async () => {
    const res = await request(app).get('/api/requests').set(otherStaff.auth);
    expect(res.body.requests).toHaveLength(0);
    const blocked = await request(app).get(`/api/requests/${mine.id}`).set(otherStaff.auth);
    expect(blocked.status).toBe(403);
  });

  it('admins can search and filter all requests', async () => {
    const res = await request(app)
      .get('/api/requests')
      .query({ search: 'visibility check', status: 'Pending', category_id: categoryId })
      .set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.requests.map((r) => r.id)).toContain(mine.id);
    expect(res.body).toMatchObject({ page: 1, total: expect.any(Number) });
  });

  it('rejects an invalid filter value', async () => {
    const res = await request(app).get('/api/requests?status=Done').set(admin.auth);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/requests/:id', () => {
  it('lets the reporter edit while Pending', async () => {
    const { body } = await submit();
    const res = await request(app)
      .put(`/api/requests/${body.request.id}`)
      .set(student.auth)
      .send({ location: 'Academic Block B, Room 204', priority: 'Urgent' });
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ location: 'Academic Block B, Room 204', priority: 'Urgent' });
  });

  it('stops the reporter editing once the request is assigned', async () => {
    const { body } = await submit();
    await request(app).patch(`/api/requests/${body.request.id}/assign`).set(admin.auth).send({ staff_id: staff.user.id });
    const res = await request(app).put(`/api/requests/${body.request.id}`).set(student.auth).send({ title: 'Changed title' });
    expect(res.status).toBe(403);
  });

  it("stops other users editing a request they don't own", async () => {
    const { body } = await submit();
    const res = await request(app).put(`/api/requests/${body.request.id}`).set(otherStudent.auth).send({ title: 'Hijack' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/requests/:id', () => {
  it('is admin only and returns 404 afterwards', async () => {
    const { body } = await submit();
    const id = body.request.id;
    expect((await request(app).delete(`/api/requests/${id}`).set(student.auth)).status).toBe(403);
    expect((await request(app).delete(`/api/requests/${id}`).set(admin.auth)).status).toBe(200);
    expect((await request(app).get(`/api/requests/${id}`).set(admin.auth)).status).toBe(404);
  });
});
