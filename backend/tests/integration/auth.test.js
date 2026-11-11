const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { uniqueEmail } = require('../helpers');

afterAll(() => db.pool.end());

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token without the password hash', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Pema Lhamo', email, password: 'Password1', role: 'staff' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email, role: 'staff' });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('returns 409 for a duplicate email', async () => {
    const body = { name: 'Dup User', email: uniqueEmail('dup'), password: 'Password1' };
    await request(app).post('/api/auth/register').send(body).expect(201);
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  it('returns 400 with field details for invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'bad', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('refuses self-registration as admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: uniqueEmail('sneaky'), password: 'Password1', role: 'admin' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login and GET /api/auth/me', () => {
  const email = uniqueEmail('login');

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ name: 'Login Tester', email, password: 'Password1' });
  });

  it('logs in (email is case-insensitive) and the token works on /me', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password: 'Password1' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('returns 401 for a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPass9' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns 401 for a forged token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('general API behaviour', () => {
  it('GET /api/health reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Route not found/);
  });

  it('malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });
});
