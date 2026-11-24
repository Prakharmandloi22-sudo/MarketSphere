const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const InventoryService = require('../inventory/inventory.service');

const router = express.Router();

/**
 * Checkout Preview: Validates items, calculates taxes, shipping, discounts, and checks stock
 */
router.post('/preview', authenticate, (req, res) => {
  const { items, promoCode, shippingAddress } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ success: false, error: { code: 'EMPTY_CART', message: 'Checkout items cannot be empty' } });
  }

  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const variant = db.memoryDb.findOne('product_variants', v => v.sku === item.sku);
    if (!variant) {
      return res.status(404).json({ success: false, error: { code: 'SKU_NOT_FOUND', message: `SKU '${item.sku}' not found` } });
    }

    const product = db.memoryDb.findById('products', variant.product_id);
    const seller = product ? db.memoryDb.findById('sellers', product.seller_id) : null;
    const invList = db.memoryDb.find('inventory_levels', inv => inv.sku === item.sku);
    const availableStock = invList.reduce((acc, i) => acc + i.available_stock, 0);

    if (availableStock < item.quantity) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: `Insufficient stock for ${product ? product.title : item.sku}. Available: ${availableStock}, Requested: ${item.quantity}`
        }
      });
    }

    const lineSubtotal = variant.price * item.quantity;
    subtotal += lineSubtotal;

    verifiedItems.push({
      sku: variant.sku,
      productName: product ? product.title : 'Product',
      variantName: variant.title,
      sellerId: seller ? seller.id : 'unknown',
      sellerName: seller ? seller.store_name : 'MarketSphere Seller',
      unitPrice: variant.price,
      quantity: item.quantity,
      subtotal: parseFloat(lineSubtotal.toFixed(2))
    });
  }

  // Calculate discount
  let discountTotal = 0;
  let appliedDiscount = null;
  if (promoCode) {
    const discount = db.memoryDb.findOne('discounts', d => d.code.toUpperCase() === promoCode.toUpperCase() && d.is_active);
    if (discount && subtotal >= discount.min_order_value) {
      discountTotal = discount.type === 'percentage' ? (subtotal * discount.value) / 100 : Math.min(discount.value, subtotal);
      appliedDiscount = discount;
    }
  }

  const shippingTotal = subtotal > 150 ? 0.00 : 15.00; // Free shipping over $150
  const taxableAmount = Math.max(0, subtotal - discountTotal);
  const taxTotal = parseFloat((taxableAmount * 0.08).toFixed(2)); // 8% sales tax
  const grandTotal = parseFloat((taxableAmount + shippingTotal + taxTotal).toFixed(2));

  res.json({
    success: true,
    data: {
      items: verifiedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountTotal: parseFloat(discountTotal.toFixed(2)),
      shippingTotal: parseFloat(shippingTotal.toFixed(2)),
      taxTotal,
      grandTotal,
      appliedDiscount: appliedDiscount ? { id: appliedDiscount.id, code: appliedDiscount.code } : null
    }
  });
});

/**
 * Execute Checkout: Atomically reserves stock and creates Order in PENDING/RESERVED state
 */
router.post('/create-order', authenticate, async (req, res, next) => {
  try {
    const { items, promoCode, shippingAddress, billingAddress, idempotencyKey } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_ITEMS', message: 'Order must contain items' } });
    }

    // Check Idempotency Key
    if (idempotencyKey) {
      const existingOrder = db.memoryDb.findOne('orders', o => o.idempotency_key === idempotencyKey);
      if (existingOrder) {
        return res.json({ success: true, message: 'Order returned from idempotency cache', data: existingOrder });
      }
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    // 1. Atomically Reserve Inventory (Assessment 07 & Capstone concurrency protection)
    const reservationResult = await InventoryService.reserveStock({
      orderId: orderNumber,
      items,
      expiresInSeconds: 600 // 10 minutes checkout reservation window
    });

    let subtotal = 0;
    const orderItemsToInsert = [];

    for (const item of items) {
      const variant = db.memoryDb.findOne('product_variants', v => v.sku === item.sku);
      const product = db.memoryDb.findById('products', variant.product_id);
      const seller = db.memoryDb.findById('sellers', product.seller_id);
      const commissionRate = seller ? seller.commission_rate : 10.00;

      const lineSubtotal = variant.price * item.quantity;
      subtotal += lineSubtotal;

      const platformFee = parseFloat(((lineSubtotal * commissionRate) / 100).toFixed(2));
      const sellerPayout = parseFloat((lineSubtotal - platformFee).toFixed(2));

      orderItemsToInsert.push({
        seller_id: seller ? seller.id : 'default-seller',
        sku: variant.sku,
        product_name: product ? product.title : 'Product',
        variant_name: variant.title,
        unit_price: variant.price,
        quantity: item.quantity,
        subtotal: parseFloat(lineSubtotal.toFixed(2)),
        platform_fee: platformFee,
        seller_payout: sellerPayout,
        fulfillment_status: 'UNFULFILLED'
      });
    }

    let discountTotal = 0;
    let discountId = null;
    if (promoCode) {
      const discount = db.memoryDb.findOne('discounts', d => d.code.toUpperCase() === promoCode.toUpperCase() && d.is_active);
      if (discount && subtotal >= discount.min_order_value) {
        discountTotal = discount.type === 'percentage' ? (subtotal * discount.value) / 100 : Math.min(discount.value, subtotal);
        discountId = discount.id;
        db.memoryDb.update('discounts', discount.id, { current_uses: discount.current_uses + 1 });
      }
    }

    const shippingTotal = subtotal > 150 ? 0.00 : 15.00;
    const taxableAmount = Math.max(0, subtotal - discountTotal);
    const taxTotal = parseFloat((taxableAmount * 0.08).toFixed(2));
    const grandTotal = parseFloat((taxableAmount + shippingTotal + taxTotal).toFixed(2));

    // Create Order Record
    const order = db.memoryDb.insert('orders', {
      order_number: orderNumber,
      user_id: req.user.id,
      status: 'RESERVED',
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_total: parseFloat(discountTotal.toFixed(2)),
      shipping_total: parseFloat(shippingTotal.toFixed(2)),
      tax_total: taxTotal,
      grand_total: grandTotal,
      discount_id: discountId,
      shipping_address: shippingAddress || { street: '123 Main St', city: 'Metropolis', state: 'NY', zip: '10001' },
      billing_address: billingAddress || shippingAddress || { street: '123 Main St', city: 'Metropolis', state: 'NY', zip: '10001' },
      idempotency_key: idempotencyKey || null,
      reservation_token: reservationResult.reservationToken
    });

    for (const oi of orderItemsToInsert) {
      db.memoryDb.insert('order_items', {
        ...oi,
        order_id: order.id
      });
    }

    res.status(201).json({
      success: true,
      data: {
        order,
        reservationToken: reservationResult.reservationToken,
        reservationExpiresAt: reservationResult.expiresAt
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
