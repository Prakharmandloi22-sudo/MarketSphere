const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { seedDatabase } = require('../src/database/seed');

test('Checkout, Order Lifecycle & Tenant Privacy Test Suite', async (t) => {
  await seedDatabase();
  const request = supertest(app);

  // Login as Customer 1
  const custRes = await request.post('/api/v1/auth/login').send({
    email: 'customer1@marketsphere.local',
    password: 'Password123!'
  });
  const customerToken = custRes.body.data.accessToken;

  let createdOrderId = null;

  await t.test('1. Preview checkout calculation with tax and shipping', async () => {
    const res = await request.post('/api/v1/checkout/preview')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ sku: 'HEADPHONE-BLK-01', quantity: 1 }],
        promoCode: 'WELCOME10'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.subtotal, 199.99);
    assert.equal(res.body.data.discountTotal, 20.00); // 10% of 199.99 rounded
    assert.ok(res.body.data.grandTotal > 0);
  });

  await t.test('2. Create order and atomically reserve stock', async () => {
    const res = await request.post('/api/v1/checkout/create-order')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ sku: 'HEADPHONE-BLK-01', quantity: 2 }],
        promoCode: 'WELCOME10',
        shippingAddress: { street: '456 Oak Ave', city: 'Denver', state: 'CO', zip: '80201' }
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.order.status, 'RESERVED');
    assert.ok(res.body.data.reservationToken);
    createdOrderId = res.body.data.order.id;
  });

  await t.test('3. Customer 2 must NOT be able to view Customer 1 order (Tenant Isolation)', async () => {
    const cust2Res = await request.post('/api/v1/auth/login').send({
      email: 'customer2@marketsphere.local',
      password: 'Password123!'
    });
    const cust2Token = cust2Res.body.data.accessToken;

    const res = await request.get(`/api/v1/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${cust2Token}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  await t.test('4. Seller must only see line items belonging to their store', async () => {
    const sellerRes = await request.post('/api/v1/auth/login').send({
      email: 'techseller@marketsphere.local',
      password: 'Password123!'
    });
    const sellerToken = sellerRes.body.data.accessToken;

    const res = await request.get(`/api/v1/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${sellerToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.items.length >= 1);
    assert.equal(res.body.data.items[0].sku, 'HEADPHONE-BLK-01');
  });
});
