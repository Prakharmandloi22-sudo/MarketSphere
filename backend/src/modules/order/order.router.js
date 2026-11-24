const express = require('express');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const InventoryService = require('../inventory/inventory.service');

const router = express.Router();

// List orders with strict Role-Based Tenant Isolation
router.get('/', authenticate, (req, res) => {
  const { role, id: userId } = req.user;
  let orders = [];

  if (role === 'customer') {
    orders = db.memoryDb.find('orders', o => o.user_id === userId);
  } else if (role === 'seller') {
    const seller = db.memoryDb.findOne('sellers', s => s.user_id === userId);
    if (!seller) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Seller profile not found' } });
    }
    const myOrderItems = db.memoryDb.find('order_items', oi => oi.seller_id === seller.id);
    const orderIds = new Set(myOrderItems.map(oi => oi.order_id));
    orders = db.memoryDb.find('orders', o => orderIds.has(o.id));
  } else {
    // Admin, Support, Warehouse
    orders = db.memoryDb.find('orders');
  }

  // Attach line items and sort newest first
  const enriched = orders.map(order => {
    let items = db.memoryDb.find('order_items', oi => oi.order_id === order.id);
    if (role === 'seller') {
      const seller = db.memoryDb.findOne('sellers', s => s.user_id === userId);
      items = items.filter(oi => oi.seller_id === seller.id);
    }
    const payment = db.memoryDb.findOne('payments', p => p.order_id === order.id);
    const shipment = db.memoryDb.findOne('shipments', s => s.order_id === order.id);

    return {
      ...order,
      items,
      payment,
      shipment
    };
  });

  enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: enriched.length, data: enriched });
});

// Get order details
router.get('/:id', authenticate, (req, res) => {
  const order = db.memoryDb.findOne('orders', o => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
  }

  // Tenant / Privacy Check
  if (req.user.role === 'customer' && order.user_id !== req.user.id) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this order' } });
  }

  let items = db.memoryDb.find('order_items', oi => oi.order_id === order.id);
  if (req.user.role === 'seller') {
    const seller = db.memoryDb.findOne('sellers', s => s.user_id === req.user.id);
    items = items.filter(oi => oi.seller_id === (seller ? seller.id : ''));
    if (!items.length) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'No items in this order belong to your store' } });
    }
  }

  const payment = db.memoryDb.findOne('payments', p => p.order_id === order.id);
  const shipment = db.memoryDb.findOne('shipments', s => s.order_id === order.id);

  res.json({
    success: true,
    data: {
      ...order,
      items,
      payment,
      shipment
    }
  });
});

// Update order status (Warehouse, Support, Admin)
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['PENDING', 'RESERVED', 'PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Status must be one of: ${allowed.join(', ')}` } });
    }

    const order = db.memoryDb.findById('orders', req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    // If cancelled and was reserved, release stock
    if (status === 'CANCELLED' && order.reservation_token && order.status === 'RESERVED') {
      await InventoryService.releaseReservation(order.reservation_token, 'ORDER_CANCELLED');
    }

    const updated = db.memoryDb.update('orders', order.id, { status });

    // Audit log
    db.memoryDb.insert('audit_logs', {
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'ORDER_STATUS_UPDATED',
      entity_type: 'ORDER',
      entity_id: order.id,
      payload: { previousStatus: order.status, newStatus: status }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
