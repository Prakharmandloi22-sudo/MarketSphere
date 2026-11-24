const express = require('express');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

function getOrCreateUserCart(userId) {
  let cart = db.memoryDb.findOne('carts', c => c.user_id === userId);
  if (!cart) {
    cart = db.memoryDb.insert('carts', { user_id: userId });
  }
  return cart;
}

// Get user cart with item details and current prices
router.get('/', authenticate, (req, res) => {
  const cart = getOrCreateUserCart(req.user.id);
  const items = db.memoryDb.find('cart_items', i => i.cart_id === cart.id);

  let subtotal = 0;
  const enrichedItems = items.map(item => {
    const variant = db.memoryDb.findOne('product_variants', v => v.sku === item.sku);
    const product = variant ? db.memoryDb.findById('products', variant.product_id) : null;
    const invList = db.memoryDb.find('inventory_levels', inv => inv.sku === item.sku);
    const availableStock = invList.reduce((acc, i) => acc + i.available_stock, 0);

    const price = variant ? variant.price : item.price_at_add;
    const lineTotal = price * item.quantity;
    subtotal += lineTotal;

    return {
      ...item,
      productTitle: product ? product.title : 'Product',
      variantTitle: variant ? variant.title : item.sku,
      unitPrice: price,
      lineTotal: parseFloat(lineTotal.toFixed(2)),
      availableStock,
      isAvailable: availableStock >= item.quantity
    };
  });

  res.json({
    success: true,
    data: {
      cartId: cart.id,
      items: enrichedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      itemCount: enrichedItems.reduce((acc, i) => acc + i.quantity, 0)
    }
  });
});

// Add or increment item in cart
router.post('/items', authenticate, (req, res) => {
  const { sku, quantity = 1 } = req.body;
  if (!sku || quantity <= 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid SKU and positive quantity required' } });
  }

  const variant = db.memoryDb.findOne('product_variants', v => v.sku === sku.toUpperCase());
  if (!variant) {
    return res.status(404).json({ success: false, error: { code: 'SKU_NOT_FOUND', message: `SKU '${sku}' not found` } });
  }

  const cart = getOrCreateUserCart(req.user.id);
  let item = db.memoryDb.findOne('cart_items', i => i.cart_id === cart.id && i.sku === variant.sku);

  if (item) {
    item = db.memoryDb.update('cart_items', item.id, {
      quantity: item.quantity + quantity
    });
  } else {
    item = db.memoryDb.insert('cart_items', {
      cart_id: cart.id,
      sku: variant.sku,
      quantity,
      price_at_add: variant.price
    });
  }

  res.status(201).json({ success: true, data: item });
});

// Update item quantity
router.patch('/items/:id', authenticate, (req, res) => {
  const { quantity } = req.body;
  const item = db.memoryDb.findById('cart_items', req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cart item not found' } });
  }

  if (quantity <= 0) {
    db.memoryDb.delete('cart_items', item.id);
    return res.json({ success: true, message: 'Item removed from cart' });
  }

  const updated = db.memoryDb.update('cart_items', item.id, { quantity: parseInt(quantity) });
  res.json({ success: true, data: updated });
});

// Remove item from cart
router.delete('/items/:id', authenticate, (req, res) => {
  const deleted = db.memoryDb.delete('cart_items', req.params.id);
  res.json({ success: true, deleted: !!deleted });
});

// Clear cart
router.delete('/', authenticate, (req, res) => {
  const cart = getOrCreateUserCart(req.user.id);
  const items = db.memoryDb.find('cart_items', i => i.cart_id === cart.id);
  items.forEach(i => db.memoryDb.delete('cart_items', i.id));
  res.json({ success: true, message: 'Cart cleared' });
});

module.exports = router;
