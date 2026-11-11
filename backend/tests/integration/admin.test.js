// Administrator features: categories, users, dashboard statistics and the event log.
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { createUser, uniqueEmail } = require('../helpers');

let admin, student;

beforeAll(async () => {
  [admin, student] = await Promise.all([createUser('admin', 'Stats Admin'), createUser('student')]);
});

afterAll(() => db.pool.end());

describe('categories', () => {
  it('any logged-in user can list the seeded categories', async () => {
    const res = await request(app).get('/api/categories').set(student.auth);
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Electrical', 'Plumbing', 'Wi-Fi', 'Furniture', 'Hostel', 'Cleaning', 'Other'])
    );
  });

  it('admins can create, rename and delete a category', async () => {
    const created = await request(app).post('/api/categories').set(admin.auth).send({ name: 'Sports Ground' });
    expect(created.status).toBe(201);
    const id = created.body.category.id;

    const dup = await request(app).post('/api/categories').set(admin.auth).send({ name: 'sports ground' });
    expect(dup.status).toBe(409);

    const renamed = await request(app).put(`/api/categories/${id}`).set(admin.auth).send({ name: 'Sports Facilities' });
    expect(renamed.body.category.name).toBe('Sports Facilities');

    expect((await request(app).delete(`/api/categories/${id}`).set(admin.auth)).status).toBe(200);
    expect((await request(app).delete(`/api/categories/${id}`).set(admin.auth)).status).toBe(404);
  });

  it('students cannot manage categories', async () => {
    const res = await request(app).post('/api/categories').set(student.auth).send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });
});

describe('users', () => {
  it('admins can create a maintenance account and filter users by role', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(admin.auth)
      .send({ name: 'New Plumber', email: uniqueEmail('plumber'), password: 'Password1', role: 'maintenance' });
    expect(res.status).toBe(201);

    const list = await request(app).get('/api/users?role=maintenance').set(admin.auth);
    expect(list.body.users.every((u) => u.role === 'maintenance')).toBe(true);
    expect(list.body.users[0]).toHaveProperty('open_assignments');
  });

  it('admins can change a role but not their own', async () => {
    const target = await createUser('student');
    const res = await request(app).patch(`/api/users/${target.user.id}/role`).set(admin.auth).send({ role: 'staff' });
    expect(res.body.user.role).toBe('staff');

    const self = await request(app).patch(`/api/users/${admin.user.id}/role`).set(admin.auth).send({ role: 'student' });
    expect(self.status).toBe(400);
  });

  it('a deleted user can no longer use their token', async () => {
    const target = await createUser('student');
    await request(app).delete(`/api/users/${target.user.id}`).set(admin.auth).expect(200);
    const res = await request(app).get('/api/auth/me').set(target.auth);
    expect(res.status).toBe(401);
  });

  it('students cannot list users', async () => {
    expect((await request(app).get('/api/users').set(student.auth)).status).toBe(403);
  });
});

describe('dashboard', () => {
  it('GET /api/stats returns totals, workload and response time', async () => {
    const res = await request(app).get('/api/stats').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        by_status: expect.objectContaining({ Pending: expect.any(Number), Completed: expect.any(Number) }),
        by_category: expect.any(Array),
        staff_workload: expect.any(Array),
      })
    );
  });

  it('GET /api/events is admin only', async () => {
    expect((await request(app).get('/api/events').set(admin.auth)).status).toBe(200);
    expect((await request(app).get('/api/events').set(student.auth)).status).toBe(403);
  });
});
