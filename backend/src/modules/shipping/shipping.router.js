const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireWarehouse } = require('../../middleware/rbac');

const router = express.Router();

// Get shipping rates for checkout
router.post('/rates', (req, res) => {
  const { weightGrams = 500, destinationZip = '10001' } = req.body;
  const rates = [
    { carrier: 'Standard Ground (USPS)', cost: 9.99, estimatedDays: '3-5 business days' },
    { carrier: 'Express Shipping (FedEx)', cost: 19.99, estimatedDays: '2 business days' },
    { carrier: 'Overnight Priority (UPS)', cost: 34.99, estimatedDays: 'Next day by 3 PM' }
  ];
  res.json({ success: true, data: rates });
});

// Generate shipping label and dispatch order (Warehouse operator)
router.post('/dispatch', authenticate, requireWarehouse, (req, res) => {
  const { orderId, carrier = 'FedEx Express', warehouseId } = req.body;
  const order = db.memoryDb.findById('orders', orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
  }

  const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`;
  const labelUrl = `https://storage.sandbox.marketsphere.local/labels/${trackingNumber}.pdf`;

  const shipment = db.memoryDb.insert('shipments', {
    order_id: order.id,
    warehouse_id: warehouseId || db.memoryDb.find('warehouses')[0].id,
    carrier,
    tracking_number: trackingNumber,
    label_url: labelUrl,
    status: 'LABEL_CREATED',
    estimated_delivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  });

  // Update order status to SHIPPED
  db.memoryDb.update('orders', order.id, { status: 'SHIPPED' });

  // Update line items fulfillment status
  const items = db.memoryDb.find('order_items', oi => oi.order_id === order.id);
  items.forEach(oi => db.memoryDb.update('order_items', oi.id, { fulfillment_status: 'SHIPPED' }));

  res.status(201).json({ success: true, data: shipment });
});

// Shipping Carrier Status Webhook Callback
router.post('/webhook', (req, res) => {
  const { trackingNumber, status, location } = req.body;
  const shipment = db.memoryDb.findOne('shipments', s => s.tracking_number === trackingNumber);
  if (!shipment) {
    return res.status(404).json({ success: false, error: { code: 'TRACKING_NOT_FOUND', message: 'Tracking number not found' } });
  }

  const updatedShipment = db.memoryDb.update('shipments', shipment.id, {
    status: status || 'DELIVERED',
    actual_delivery: status === 'DELIVERED' ? new Date().toISOString() : null
  });

  if (status === 'DELIVERED') {
    db.memoryDb.update('orders', shipment.order_id, { status: 'DELIVERED' });
    const items = db.memoryDb.find('order_items', oi => oi.order_id === shipment.order_id);
    items.forEach(oi => db.memoryDb.update('order_items', oi.id, { fulfillment_status: 'DELIVERED' }));
  }

  res.json({ success: true, data: updatedShipment });
});

module.exports = router;
