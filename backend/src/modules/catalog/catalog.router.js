const express = require('express');
const { z } = require('zod');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireSeller, requireAdmin } = require('../../middleware/rbac');
const { validateRequest } = require('../../middleware/validate');

const router = express.Router();

// 1. Get all categories
router.get('/categories', (req, res) => {
  const categories = db.memoryDb.find('categories');
  res.json({ success: true, data: categories });
});

// 2. Create category (Admin)
router.post('/categories', authenticate, requireAdmin, (req, res) => {
  const { name, slug, parentId, commissionOverride } = req.body;
  const cat = db.memoryDb.insert('categories', {
    name,
    slug,
    parent_id: parentId || null,
    commission_override: commissionOverride || null
  });
  res.status(201).json({ success: true, data: cat });
});

// 3. Search and filter products
router.get('/products', (req, res) => {
  const { q, category, minPrice, maxPrice, sellerId, inStock, sort = 'newest' } = req.query;

  let products = db.memoryDb.find('products', p => p.is_active);

  if (category) {
    const cat = db.memoryDb.findOne('categories', c => c.slug === category || c.id === category);
    if (cat) {
      products = products.filter(p => p.category_id === cat.id);
    }
  }

  if (sellerId) {
    products = products.filter(p => p.seller_id === sellerId);
  }

  if (q) {
    const term = q.toLowerCase();
    products = products.filter(p => p.title.toLowerCase().includes(term) || (p.description && p.description.toLowerCase().includes(term)));
  }

  // Attach variants, reviews, and stock
  let enriched = products.map(product => {
    const variants = db.memoryDb.find('product_variants', v => v.product_id === product.id && v.is_active);
    const seller = db.memoryDb.findById('sellers', product.seller_id);
    const reviews = db.memoryDb.find('reviews', r => r.product_id === product.id);
    const avgRating = reviews.length ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 5.0;

    // Calculate total available stock across variants
    let totalStock = 0;
    variants.forEach(v => {
      const invList = db.memoryDb.find('inventory_levels', inv => inv.sku === v.sku);
      v.availableStock = invList.reduce((acc, i) => acc + i.available_stock, 0);
      totalStock += v.availableStock;
    });

    return {
      ...product,
      sellerName: seller ? seller.store_name : 'Unknown Seller',
      variants,
      rating: parseFloat(avgRating.toFixed(1)),
      reviewCount: reviews.length,
      totalAvailableStock: totalStock
    };
  });

  if (minPrice) enriched = enriched.filter(p => p.base_price >= parseFloat(minPrice));
  if (maxPrice) enriched = enriched.filter(p => p.base_price <= parseFloat(maxPrice));
  if (inStock === 'true') enriched = enriched.filter(p => p.totalAvailableStock > 0);

  // Sorting
  if (sort === 'price_asc') enriched.sort((a, b) => a.base_price - b.base_price);
  else if (sort === 'price_desc') enriched.sort((a, b) => b.base_price - a.base_price);
  else if (sort === 'rating') enriched.sort((a, b) => b.rating - a.rating);
  else enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ success: true, count: enriched.length, data: enriched });
});

// 4. Get product detail by ID or Slug
router.get('/products/:id', (req, res) => {
  const { id } = req.params;
  const product = db.memoryDb.findOne('products', p => p.id === id || p.slug === id);
  if (!product) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
  }

  const variants = db.memoryDb.find('product_variants', v => v.product_id === product.id && v.is_active);
  const seller = db.memoryDb.findById('sellers', product.seller_id);
  const reviews = db.memoryDb.find('reviews', r => r.product_id === product.id);
  const avgRating = reviews.length ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 5.0;

  variants.forEach(v => {
    const invList = db.memoryDb.find('inventory_levels', inv => inv.sku === v.sku);
    v.availableStock = invList.reduce((acc, i) => acc + i.available_stock, 0);
  });

  res.json({
    success: true,
    data: {
      ...product,
      seller,
      variants,
      reviews,
      avgRating: parseFloat(avgRating.toFixed(1))
    }
  });
});

// 5. Create product (Seller)
router.post('/products', authenticate, requireSeller, (req, res, next) => {
  try {
    const seller = db.memoryDb.findOne('sellers', s => s.user_id === req.user.id);
    if (!seller && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only active sellers can create products' } });
    }

    const { title, description, categoryId, basePrice, variants } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const product = db.memoryDb.insert('products', {
      seller_id: seller ? seller.id : req.body.sellerId,
      category_id: categoryId,
      title,
      slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
      description,
      base_price: parseFloat(basePrice),
      is_active: true
    });

    const createdVariants = [];
    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        const variant = db.memoryDb.insert('product_variants', {
          product_id: product.id,
          sku: v.sku.toUpperCase(),
          title: v.title || `${title} - Standard`,
          price: parseFloat(v.price || basePrice),
          compare_at_price: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
          attributes: v.attributes || {},
          is_active: true
        });
        createdVariants.push(variant);

        // Default inventory in first warehouse
        const defaultWh = db.memoryDb.find('warehouses')[0];
        if (defaultWh) {
          db.memoryDb.insert('inventory_levels', {
            sku: variant.sku,
            warehouse_id: defaultWh.id,
            available_stock: v.initialStock !== undefined ? parseInt(v.initialStock) : 10,
            reserved_stock: 0,
            safety_stock: 0,
            version: 1
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      data: { ...product, variants: createdVariants }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
