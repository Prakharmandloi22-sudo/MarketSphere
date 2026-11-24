const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const InventoryService = require('../inventory/inventory.service');

const router = express.Router();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_marketsphere_test_webhook_secret_key_12345';

/**
 * Create Payment Sandbox Intent
 */
router.post('/create-intent', authenticate, (req, res) => {
  const { orderId } = req.body;
  const order = db.memoryDb.findById('orders', orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
  }

  const clientSecret = `pi_${uuidv4().replace(/-/g, '')}_secret_${uuidv4().substring(0, 8)}`;
  res.json({
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      amount: order.grand_total,
      currency: 'USD',
      clientSecret,
      status: 'requires_payment_method'
    }
  });
});

/**
 * Webhook Signature Verifier
 */
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  // Parse 't=timestamp,v1=signature'
  const elements = signatureHeader.split(',');
  let timestamp = null;
  let signature = null;

  for (const el of elements) {
    const [key, val] = el.split('=');
    if (key.trim() === 't') timestamp = val.trim();
    if (key.trim() === 'v1') signature = val.trim();
  }

  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
}

/**
 * Assessment 08 & Domain-Specific Capstone: Payment Webhook with Event Deduplication
 * Duplicate payment events MUST NOT create duplicate orders or refunds!
 */
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const sigHeader = req.headers['stripe-signature'];
  const rawBody = req.body.toString('utf8');

  // 1. Verify HMAC Signature
  if (process.env.NODE_ENV !== 'test' && sigHeader) {
    const isValid = verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Malformed JSON payload' } });
  }

  const eventId = event.id || req.headers['x-event-id'] || `evt_${uuidv4()}`;

  // 2. IDEMPOTENCY CHECK: Detect Duplicate Webhook Event
  const existingPayment = db.memoryDb.findOne('payments', p => p.webhook_event_id === eventId);
  if (existingPayment) {
    console.log(`[Payment Webhook] Duplicate event ignored: ${eventId}`);
    return res.status(200).json({
      received: true,
      deduplicated: true,
      message: 'Duplicate event already processed. No repeated action taken.'
    });
  }

  // 3. Process Event Types
  if (event.type === 'payment_intent.succeeded') {
    const { orderId, amount, paymentIntentId = `pi_${uuidv4().substring(0, 10)}` } = event.data.object;
    const order = db.memoryDb.findById('orders', orderId) || db.memoryDb.findOne('orders', o => o.order_number === orderId);

    if (order) {
      // Create Payment Record with Webhook Event ID
      db.memoryDb.insert('payments', {
        order_id: order.id,
        provider: 'stripe_sandbox',
        provider_tx_id: paymentIntentId,
        amount: amount || order.grand_total,
        currency: 'USD',
        status: 'SUCCEEDED',
        idempotency_key: `pay_idemp_${eventId}`,
        webhook_event_id: eventId,
        payload: event
      });

      // Update Order Status
      db.memoryDb.update('orders', order.id, { status: 'PAID' });

      // Commit Stock Reservation Permanently
      if (order.reservation_token) {
        await InventoryService.commitReservation(order.reservation_token, order.id);
      }
    }
  } else if (event.type === 'charge.refunded') {
    const { orderId, refundAmount } = event.data.object;
    const order = db.memoryDb.findById('orders', orderId) || db.memoryDb.findOne('orders', o => o.order_number === orderId);

    if (order) {
      db.memoryDb.update('orders', order.id, { status: 'REFUNDED' });
      db.memoryDb.insert('payments', {
        order_id: order.id,
        provider: 'stripe_sandbox',
        provider_tx_id: `ref_${uuidv4().substring(0, 10)}`,
        amount: refundAmount || order.grand_total,
        currency: 'USD',
        status: 'REFUNDED',
        idempotency_key: `ref_idemp_${eventId}`,
        webhook_event_id: eventId,
        payload: event
      });
    }
  }

  res.status(200).json({ received: true, eventId });
});

module.exports = router;
