const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { seedDatabase } = require('../src/database/seed');

test('Auth & Role-Based Access Control Test Suite', async (t) => {
  await seedDatabase();
  const request = supertest(app);

  await t.test('1. Should register a new customer', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      email: 'newbuyer@example.com',
      password: 'StrongPassword123!',
      fullName: 'John Doe',
      role: 'customer'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.email, 'newbuyer@example.com');
  });

  await t.test('2. Should reject duplicate registration', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      email: 'newbuyer@example.com',
      password: 'StrongPassword123!',
      fullName: 'John Doe'
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'USER_EXISTS');
  });

  await t.test('3. Should login with valid credentials', async () => {
    const res = await request.post('/api/v1/auth/login').send({
      email: 'admin@marketsphere.local',
      password: 'Password123!'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.role, 'admin');
    assert.ok(res.body.data.accessToken);
  });

  await t.test('4. Should reject login with invalid password', async () => {
    const res = await request.post('/api/v1/auth/login').send({
      email: 'admin@marketsphere.local',
      password: 'WrongPassword!'
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  await t.test('5. Should protect admin-only route from unauthenticated request', async () => {
    const res = await request.get('/api/v1/sellers');
    assert.equal(res.status, 401);
  });

  await t.test('6. Should protect admin-only route from customer role (403 Forbidden)', async () => {
    // Login as customer
    const loginRes = await request.post('/api/v1/auth/login').send({
      email: 'customer1@marketsphere.local',
      password: 'Password123!'
    });
    const token = loginRes.body.data.accessToken;

    const res = await request.get('/api/v1/sellers').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});
