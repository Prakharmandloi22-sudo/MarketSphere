const express = require('express');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/rbac');

const router = express.Router();

// List active discounts (Public)
router.get('/', (req, res) => {
  const now = new Date().toISOString();
  const discounts = db.memoryDb.find('discounts', d => d.is_active && d.valid_until > now);
  res.json({ success: true, data: discounts });
});

// Validate discount code for an order subtotal
router.post('/validate', (req, res) => {
  const { code, subtotal = 0 } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: { code: 'CODE_REQUIRED', message: 'Discount code is required' } });
  }

  const now = new Date().toISOString();
  const discount = db.memoryDb.findOne('discounts', d => d.code.toUpperCase() === code.trim().toUpperCase());

  if (!discount || !discount.is_active || discount.valid_until < now) {
    return res.status(404).json({ success: false, error: { code: 'INVALID_CODE', message: 'Promotion code is invalid or expired' } });
  }

  if (discount.max_uses && discount.current_uses >= discount.max_uses) {
    return res.status(400).json({ success: false, error: { code: 'USAGE_LIMIT_REACHED', message: 'Promotion usage limit has been reached' } });
  }

  if (subtotal < discount.min_order_value) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MIN_ORDER_NOT_MET',
        message: `Promotion requires a minimum order of $${discount.min_order_value.toFixed(2)}. Current subtotal: $${parseFloat(subtotal).toFixed(2)}`
      }
    });
  }

  let discountAmount = 0;
  if (discount.type === 'percentage') {
    discountAmount = (subtotal * discount.value) / 100;
  } else {
    discountAmount = Math.min(discount.value, subtotal);
  }

  res.json({
    success: true,
    data: {
      discountId: discount.id,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      newSubtotal: parseFloat((subtotal - discountAmount).toFixed(2))
    }
  });
});

// Create new discount code (Admin)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { code, type, value, minOrderValue = 0, maxUses = null, validDays = 30 } = req.body;
  const existing = db.memoryDb.findOne('discounts', d => d.code.toUpperCase() === code.toUpperCase());
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'CODE_EXISTS', message: 'Discount code already exists' } });
  }

  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
  const discount = db.memoryDb.insert('discounts', {
    code: code.toUpperCase(),
    type,
    value: parseFloat(value),
    min_order_value: parseFloat(minOrderValue),
    max_uses: maxUses ? parseInt(maxUses) : null,
    current_uses: 0,
    is_active: true,
    valid_from: new Date().toISOString(),
    valid_until: validUntil
  });

  res.status(201).json({ success: true, data: discount });
});

module.exports = router;
