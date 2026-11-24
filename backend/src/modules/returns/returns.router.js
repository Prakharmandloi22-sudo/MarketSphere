const express = require('express');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireSupport } = require('../../middleware/rbac');

const router = express.Router();

// Customer submits a return request
router.post('/', authenticate, (req, res) => {
  const { orderId, orderItemId, reason } = req.body;
  const order = db.memoryDb.findById('orders', orderId);
  if (!order || order.user_id !== req.user.id) {
    return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found or not owned by user' } });
  }

  const orderItem = db.memoryDb.findById('order_items', orderItemId);
  if (!orderItem || orderItem.order_id !== order.id) {
    return res.status(404).json({ success: false, error: { code: 'ITEM_NOT_FOUND', message: 'Order line item not found' } });
  }

  const returnReq = db.memoryDb.insert('returns', {
    order_id: order.id,
    order_item_id: orderItem.id,
    user_id: req.user.id,
    reason: reason || 'Customer requested return',
    status: 'REQUESTED',
    refund_amount: orderItem.subtotal,
    is_restocked: false
  });

  res.status(201).json({ success: true, data: returnReq });
});

// View returns (Support/Admin views all; Customer views theirs)
router.get('/', authenticate, (req, res) => {
  let returns = [];
  if (req.user.role === 'customer') {
    returns = db.memoryDb.find('returns', r => r.user_id === req.user.id);
  } else {
    returns = db.memoryDb.find('returns');
  }

  res.json({ success: true, count: returns.length, data: returns });
});

// Support / Warehouse inspects and approves return / issues refund
router.patch('/:id/action', authenticate, requireSupport, (req, res) => {
  const { action, restock = true } = req.body; // 'APPROVE', 'REJECT', 'REFUND'
  const returnReq = db.memoryDb.findById('returns', req.params.id);
  if (!returnReq) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Return request not found' } });
  }

  let status = returnReq.status;
  if (action === 'APPROVE') status = 'APPROVED';
  else if (action === 'REJECT') status = 'REJECTED';
  else if (action === 'REFUND') {
    status = 'REFUNDED';
    // Restock returned item to available inventory
    if (restock && !returnReq.is_restocked) {
      const orderItem = db.memoryDb.findById('order_items', returnReq.order_item_id);
      if (orderItem) {
        const inv = db.memoryDb.findOne('inventory_levels', i => i.sku === orderItem.sku);
        if (inv) {
          db.memoryDb.update('inventory_levels', inv.id, {
            available_stock: inv.available_stock + orderItem.quantity,
            version: inv.version + 1
          });
          db.memoryDb.insert('inventory_ledger', {
            sku: orderItem.sku,
            warehouse_id: inv.warehouse_id,
            change_qty: orderItem.quantity,
            balance_after: inv.available_stock + orderItem.quantity,
            reason: 'RETURN_RESTOCK',
            reference_type: 'RETURN',
            reference_id: returnReq.id
          });
        }
      }
      db.memoryDb.update('returns', returnReq.id, { is_restocked: true });
    }
  }

  const updated = db.memoryDb.update('returns', returnReq.id, { status });
  res.json({ success: true, data: updated });
});

module.exports = router;
