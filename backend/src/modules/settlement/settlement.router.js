const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireSeller, requireAdmin } = require('../../middleware/rbac');

const router = express.Router();

// Get seller settlements
router.get('/', authenticate, requireSeller, (req, res) => {
  let settlements = [];
  if (req.user.role === 'seller') {
    const seller = db.memoryDb.findOne('sellers', s => s.user_id === req.user.id);
    if (!seller) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Seller profile not found' } });
    }
    settlements = db.memoryDb.find('seller_settlements', s => s.seller_id === seller.id);
  } else {
    settlements = db.memoryDb.find('seller_settlements');
  }

  settlements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: settlements.length, data: settlements });
});

// Admin: Run settlement calculation batch
router.post('/calculate', authenticate, requireAdmin, (req, res) => {
  const sellers = db.memoryDb.find('sellers', s => s.kyc_status === 'approved');
  const periodStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = new Date().toISOString();
  const createdSettlements = [];

  for (const seller of sellers) {
    const orderItems = db.memoryDb.find('order_items', oi => oi.seller_id === seller.id);
    const grossSales = orderItems.reduce((acc, oi) => acc + oi.subtotal, 0);
    const commissionDeducted = orderItems.reduce((acc, oi) => acc + oi.platform_fee, 0);
    const netPayout = parseFloat((grossSales - commissionDeducted).toFixed(2));

    const settlement = db.memoryDb.insert('seller_settlements', {
      seller_id: seller.id,
      period_start: periodStart,
      period_end: periodEnd,
      gross_sales: parseFloat(grossSales.toFixed(2)),
      commission_deducted: parseFloat(commissionDeducted.toFixed(2)),
      refund_deductions: 0.00,
      net_payout: netPayout,
      status: 'PENDING',
      payout_tx_id: `PO-${uuidv4().substring(0, 8).toUpperCase()}`
    });

    createdSettlements.push(settlement);
  }

  res.status(201).json({ success: true, count: createdSettlements.length, data: createdSettlements });
});

module.exports = router;
