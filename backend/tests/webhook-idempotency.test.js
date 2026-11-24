const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { seedDatabase } = require('../src/database/seed');
const db = require('../src/database/db');

test('ASSESSMENT 08 & CAPSTONE: Webhook Idempotency & Deduplication', async (t) => {
  await seedDatabase();
  const request = supertest(app);

  // Setup: Create an order to be paid
  const custRes = await request.post('/api/v1/auth/login').send({
    email: 'customer1@marketsphere.local',
    password: 'Password123!'
  });
  const token = custRes.body.data.accessToken;

  const orderRes = await request.post('/api/v1/checkout/create-order')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ sku: 'HOODIE-M-GRY', quantity: 1 }] });
  
  const orderId = orderRes.body.data.order.id;
  const eventId = `evt_test_payment_${Date.now()}`;

  const payload = {
    id: eventId,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        orderId,
        amount: 89.00,
        paymentIntentId: 'pi_test_12345678'
      }
    }
  };

  await t.test('1. First payment event successfully marks order as PAID', async () => {
    const res = await request.post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-event-id', eventId)
      .send(JSON.stringify(payload));

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);

    const order = db.memoryDb.findById('orders', orderId);
    assert.equal(order.status, 'PAID');

    const payments = db.memoryDb.find('payments', p => p.order_id === orderId);
    assert.equal(payments.length, 1);
  });

  await t.test('2. Duplicate payment event is deduplicated without double processing or duplicate records', async () => {
    // Send EXACT SAME webhook event again
    const res = await request.post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-event-id', eventId)
      .send(JSON.stringify(payload));

    assert.equal(res.status, 200);
    assert.equal(res.body.deduplicated, true);

    // Verify still exactly 1 payment record exists for this order
    const payments = db.memoryDb.find('payments', p => p.order_id === orderId);
    assert.equal(payments.length, 1, 'Duplicate payment event must not create a second payment record');
  });
});
