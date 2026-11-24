const express = require('express');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireSeller, requireWarehouse } = require('../../middleware/rbac');
const InventoryService = require('./inventory.service');

const router = express.Router();

// Get inventory levels (Seller sees their products, Warehouse/Admin sees all)
router.get('/', authenticate, (req, res) => {
  let inventory = db.memoryDb.find('inventory_levels');
  const warehouses = db.memoryDb.find('warehouses');
  const whMap = new Map(warehouses.map(w => [w.id, w.name]));

  if (req.user.role === 'seller') {
    const seller = db.memoryDb.findOne('sellers', s => s.user_id === req.user.id);
    if (!seller) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Seller profile not found' } });
    }
    const sellerProducts = db.memoryDb.find('products', p => p.seller_id === seller.id);
    const prodIds = new Set(sellerProducts.map(p => p.id));
    const sellerVariants = db.memoryDb.find('product_variants', v => prodIds.has(v.product_id));
    const sellerSkus = new Set(sellerVariants.map(v => v.sku));
    inventory = inventory.filter(i => sellerSkus.has(i.sku));
  }

  const enriched = inventory.map(item => ({
    ...item,
    warehouseName: whMap.get(item.warehouse_id) || 'Unknown Warehouse'
  }));

  res.json({ success: true, count: enriched.length, data: enriched });
});

// View inventory movements ledger
router.get('/ledger', authenticate, requireWarehouse, (req, res) => {
  const { sku } = req.query;
  let ledger = db.memoryDb.find('inventory_ledger');
  if (sku) {
    ledger = ledger.filter(l => l.sku === sku.toUpperCase());
  }
  ledger.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: ledger.length, data: ledger });
});

// Manual stock adjustment (Warehouse Operator / Admin)
router.post('/adjust', authenticate, requireWarehouse, async (req, res, next) => {
  try {
    const { sku, warehouseId, changeQty, reason = 'STOCK_IN', referenceType = 'MANUAL', referenceId = 'OPERATOR_ADJUSTMENT' } = req.body;
    if (!sku || changeQty === undefined) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'SKU and changeQty are required' } });
    }

    const release = await db.acquireLock(`sku_lock_${sku}`);
    try {
      let inv = db.memoryDb.findOne('inventory_levels', i => i.sku === sku && (!warehouseId || i.warehouse_id === warehouseId));
      if (!inv) {
        const wh = warehouseId ? db.memoryDb.findById('warehouses', warehouseId) : db.memoryDb.find('warehouses')[0];
        inv = db.memoryDb.insert('inventory_levels', {
          sku,
          warehouse_id: wh ? wh.id : 'default-wh',
          available_stock: 0,
          reserved_stock: 0,
          safety_stock: 0,
          version: 1
        });
      }

      const newAvailable = inv.available_stock + parseInt(changeQty);
      if (newAvailable < 0) {
        return res.status(400).json({ success: false, error: { code: 'INSUFFICIENT_STOCK', message: 'Resulting stock cannot be negative' } });
      }

      const updated = db.memoryDb.update('inventory_levels', inv.id, {
        available_stock: newAvailable,
        version: inv.version + 1
      });

      db.memoryDb.insert('inventory_ledger', {
        sku,
        warehouse_id: inv.warehouse_id,
        change_qty: parseInt(changeQty),
        balance_after: newAvailable,
        reason,
        reference_type: referenceType,
        reference_id: referenceId
      });

      res.json({ success: true, data: updated });
    } finally {
      release();
    }
  } catch (err) {
    next(err);
  }
});

// Trigger sweep for expired reservations
router.post('/sweep-expired', authenticate, async (req, res) => {
  const expiredCount = await InventoryService.sweepExpiredReservations();
  res.json({ success: true, sweptReservations: expiredCount });
});

module.exports = router;
