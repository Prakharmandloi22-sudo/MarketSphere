const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../src/app');
const { seedDatabase } = require('../src/database/seed');

test('Catalog, Search & Promotions Test Suite', async (t) => {
  await seedDatabase();
  const request = supertest(app);

  await t.test('1. Should list all active products', async () => {
    const res = await request.get('/api/v1/catalog/products');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 3);
  });

  await t.test('2. Should search products by keyword query', async () => {
    const res = await request.get('/api/v1/catalog/products?q=Headphones');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.match(res.body.data[0].title, /Headphones/i);
  });

  await t.test('3. Should filter products by category', async () => {
    const res = await request.get('/api/v1/catalog/products?category=apparel');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.match(res.body.data[0].title, /Hoodie/i);
  });

  await t.test('4. Should validate coupon WELCOME10 for qualifying subtotal', async () => {
    const res = await request.post('/api/v1/promotions/validate').send({
      code: 'WELCOME10',
      subtotal: 100.00
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.discountAmount, 10.00);
    assert.equal(res.body.data.newSubtotal, 90.00);
  });

  await t.test('5. Should reject coupon when order subtotal is below minimum', async () => {
    const res = await request.post('/api/v1/promotions/validate').send({
      code: 'WELCOME10',
      subtotal: 30.00 // min order is $50
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'MIN_ORDER_NOT_MET');
  });
});
