const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { seedDatabase } = require('../src/database/seed');
const db = require('../src/database/db');

test('CAPSTONE CHALLENGE & ASSESSMENT 07: Concurrency & Overselling Protection', async (t) => {
  await seedDatabase();
  const request = supertest(app);

  // Setup: Get Customer 1 and Customer 2 Tokens
  const [c1Res, c2Res] = await Promise.all([
    request.post('/api/v1/auth/login').send({ email: 'customer1@marketsphere.local', password: 'Password123!' }),
    request.post('/api/v1/auth/login').send({ email: 'customer2@marketsphere.local', password: 'Password123!' })
  ]);
  const token1 = c1Res.body.data.accessToken;
  const token2 = c2Res.body.data.accessToken;

  await t.test('Two customers attempt to buy the last item simultaneously (Stock = 1)', async () => {
    // Verify initial stock of flash sale item WATCH-LTD-01 is exactly 1
    const inv = db.memoryDb.findOne('inventory_levels', i => i.sku === 'WATCH-LTD-01');
    assert.equal(inv.available_stock, 1, 'Initial available stock must be exactly 1');

    // Launch simultaneous checkout requests
    const [res1, res2] = await Promise.all([
      request.post('/api/v1/checkout/create-order')
        .set('Authorization', `Bearer ${token1}`)
        .send({ items: [{ sku: 'WATCH-LTD-01', quantity: 1 }] }),
      request.post('/api/v1/checkout/create-order')
        .set('Authorization', `Bearer ${token2}`)
        .send({ items: [{ sku: 'WATCH-LTD-01', quantity: 1 }] })
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Exactly one must succeed with 201 Created, and exactly one must fail with 409 Conflict!
    assert.deepEqual(
      statuses,
      [201, 409],
      `Expected [201, 409] but received [${res1.status}, ${res2.status}]`
    );

    const winner = res1.status === 201 ? res1 : res2;
    const loser = res1.status === 409 ? res1 : res2;

    assert.equal(winner.body.success, true);
    assert.equal(winner.body.data.order.status, 'RESERVED');

    assert.equal(loser.body.success, false);
    assert.equal(loser.body.error.code, 'OUT_OF_STOCK');

    // Verify remaining available stock is now 0 (no negative stock, no overselling!)
    const invAfter = db.memoryDb.findOne('inventory_levels', i => i.sku === 'WATCH-LTD-01');
    assert.equal(invAfter.available_stock, 0, 'Available stock must be 0 after successful reservation');
    assert.equal(invAfter.reserved_stock, 1, 'Reserved stock must be exactly 1');
  });

  await t.test('Releasing reservation restores stock correctly', async () => {
    const resv = db.memoryDb.findOne('stock_reservations', r => r.sku === 'WATCH-LTD-01' && r.status === 'ACTIVE');
    assert.ok(resv, 'Active reservation must exist');

    const InventoryService = require('../src/modules/inventory/inventory.service');
    await InventoryService.releaseReservation(resv.reservation_token, 'CUSTOMER_CANCELLED');

    const invRestored = db.memoryDb.findOne('inventory_levels', i => i.sku === 'WATCH-LTD-01');
    assert.equal(invRestored.available_stock, 1, 'Available stock should be restored to 1');
    assert.equal(invRestored.reserved_stock, 0, 'Reserved stock should be 0');
  });
});
