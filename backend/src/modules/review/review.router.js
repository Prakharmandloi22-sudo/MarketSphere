const express = require('express');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Get reviews for a product
router.get('/product/:productId', (req, res) => {
  const reviews = db.memoryDb.find('reviews', r => r.product_id === req.params.productId);
  const avg = reviews.length ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 5.0;

  res.json({
    success: true,
    data: {
      averageRating: parseFloat(avg.toFixed(1)),
      totalReviews: reviews.length,
      reviews
    }
  });
});

// Post a review with verified purchase check
router.post('/', authenticate, (req, res) => {
  const { productId, rating, comment } = req.body;
  if (!productId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid productId and rating (1-5) required' } });
  }

  // Check if customer purchased this product and order is DELIVERED
  const customerOrders = db.memoryDb.find('orders', o => o.user_id === req.user.id && (o.status === 'DELIVERED' || o.status === 'PAID'));
  const orderIds = new Set(customerOrders.map(o => o.id));

  const variants = db.memoryDb.find('product_variants', v => v.product_id === productId);
  const skus = new Set(variants.map(v => v.sku));

  const purchasedItem = db.memoryDb.findOne('order_items', oi => orderIds.has(oi.order_id) && skus.has(oi.sku));
  const isVerifiedPurchase = !!purchasedItem;

  const existingReview = db.memoryDb.findOne('reviews', r => r.product_id === productId && r.user_id === req.user.id);
  if (existingReview) {
    const updated = db.memoryDb.update('reviews', existingReview.id, {
      rating: parseInt(rating),
      comment: comment || existingReview.comment,
      is_verified_purchase: isVerifiedPurchase
    });
    return res.json({ success: true, message: 'Review updated', data: updated });
  }

  const review = db.memoryDb.insert('reviews', {
    product_id: productId,
    user_id: req.user.id,
    order_id: purchasedItem ? purchasedItem.order_id : null,
    rating: parseInt(rating),
    comment: comment || '',
    is_verified_purchase: isVerifiedPurchase
  });

  res.status(201).json({ success: true, data: review });
});

module.exports = router;
